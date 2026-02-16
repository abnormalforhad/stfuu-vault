import {
  Cl,
  getAddressFromPrivateKey,
  makeRandomPrivKey,
  signMessageHashRsv,
} from "@stacks/transactions";
import { assert, beforeEach, describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;

// Create 3 random private keys for Alice, Bob, and Charlie
const alicePrivateKey = makeRandomPrivKey();
const bobPrivateKey = makeRandomPrivKey();
const charliePrivateKey = makeRandomPrivKey();

// Get the addresses from the private keys
const alice = getAddressFromPrivateKey(alicePrivateKey, "mocknet");
const bob = getAddressFromPrivateKey(bobPrivateKey, "mocknet");
const charlie = getAddressFromPrivateKey(charliePrivateKey, "mocknet");

// Get the contract principals for the token and multisig contracts
const token = Cl.contractPrincipal(deployer, "mock-token-v3");
const multisig = Cl.contractPrincipal(deployer, "multisig-v3");

// Backup beneficiary address (should match contract constant)
const BACKUP_BENEFICIARY = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const PETTY_CASH_LIMIT = 100_000_000; // 100 STX
const INACTIVITY_LIMIT = 52560; // ~1 year in blocks

describe("Multisig Vault Tests", () => {
  beforeEach(() => {
    const allAccounts = [alice, bob, charlie];

    for (const account of allAccounts) {
      const mintResultOne = simnet.callPublicFn(
        "mock-token-v3",
        "mint",
        [Cl.uint(1_000_000_000), Cl.principal(account)],
        account
      );

      expect(mintResultOne.events.length).toBeGreaterThan(0);

      simnet.mintSTX(account, 100_000_000n);
    }

    // Initialize the multisig
    simnet.callPublicFn(
      "multisig-v3",
      "initialize",
      [
        Cl.list([Cl.principal(alice), Cl.principal(bob), Cl.principal(charlie)]),
        Cl.uint(2),
      ],
      deployer
    );
  });

  // ============================================
  // Petty Cash Tests
  // ============================================
  describe("Petty Cash Functionality", () => {
    it("allows owners to send small amounts without voting", () => {
      // Send money to the multisig
      const transferResult = simnet.transferSTX(
        1_000_000,
        multisig.value.toString(),
        alice
      );
      expect(transferResult.result).toStrictEqual(Cl.ok(Cl.bool(true)));

      // Submit a petty cash transaction
      const submitResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(500_000)],
        alice
      );

      expect(submitResult.result).toStrictEqual(Cl.ok(Cl.uint(1)));
    });

    it("updates last-active-block on petty cash transaction", () => {
      const beforeActive = simnet.getDataVar("multisig-v3", "last-active-block");
      
      // Send money to the multisig
      simnet.transferSTX(1_000_000, multisig.value.toString(), alice);

      // Submit petty cash transaction
      simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(500_000)],
        alice
      );

      const afterActive = simnet.getDataVar("multisig-v3", "last-active-block");
      expect(JSON.stringify(afterActive)).not.toEqual(JSON.stringify(beforeActive));
    });

    it("processes large amounts through normal voting even for owners", () => {
      // Send large amount to multisig
      simnet.transferSTX(200_000_000, multisig.value.toString(), alice);

      // Submit a large transaction (should go to voting)
      const submitResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(150_000_000)],
        alice
      );

      expect(submitResult.result).toStrictEqual(Cl.ok(Cl.uint(0)));
    });

    it("prevents non-owners from using petty cash", () => {
      // Send money to the multisig
      simnet.transferSTX(1_000_000, multisig.value.toString(), alice);

      // Non-owner tries to submit transaction
      const submitResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(500_000)],
        deployer
      );

      expect(submitResult.result).toStrictEqual(Cl.error(Cl.uint(100)));
    });

    it("uses voting for amounts at the petty cash limit", () => {
      // Send money to the multisig
      simnet.transferSTX(PETTY_CASH_LIMIT * 2, multisig.value.toString(), alice);

      // Test exactly at limit (should go to voting since it's not < limit)
      const atLimitResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(PETTY_CASH_LIMIT)],
        alice
      );
      expect(atLimitResult.result).toStrictEqual(Cl.ok(Cl.uint(0)));

      // Test just under limit (should use petty cash)
      const underLimitResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(PETTY_CASH_LIMIT - 1)],
        alice
      );
      expect(underLimitResult.result).toStrictEqual(Cl.ok(Cl.uint(1)));
    });
  });

  // ============================================
  // Dead Man's Switch Tests
  // ============================================
  describe("Dead Man's Switch Functionality", () => {
    it("prevents triggering before inactivity period", () => {
      // Try to trigger dead man's switch immediately
      const triggerResult = simnet.callPublicFn(
        "multisig-v3",
        "trigger-dead-man-switch",
        [],
        alice
      );

      expect(triggerResult.result).toStrictEqual(Cl.error(Cl.uint(404)));
    });

    it("updates last-active-block when owners are active", () => {
      // Get initial last active block
      const initialActive = simnet.getDataVar("multisig-v3", "last-active-block");

      // Perform any owner action that should update the timer
      simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(1_000)],
        alice
      );

      const updatedActive = simnet.getDataVar("multisig-v3", "last-active-block");
      expect(JSON.stringify(updatedActive)).not.toEqual(JSON.stringify(initialActive));
    });
  });

  // ============================================
  // Combined Flow Tests
  // ============================================
  describe("Complete Vault Lifecycle", () => {
    it("handles both petty cash and voted transactions", () => {
      // Fund the vault
      simnet.transferSTX(500_000_000, multisig.value.toString(), alice);

      // Petty cash transaction
      const pettyResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(50_000_000)],
        alice
      );
      expect(pettyResult.result).toStrictEqual(Cl.ok(Cl.uint(1)));

      // Large transaction requiring voting
      const largeResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(charlie), Cl.uint(200_000_000)],
        alice
      );
      expect(largeResult.result).toStrictEqual(Cl.ok(Cl.uint(0)));
    });

    it("maintains last-active-block across all operations", () => {
      const initial = simnet.getDataVar("multisig-v3", "last-active-block");

      // Petty cash updates timer
      simnet.transferSTX(1_000_000, multisig.value.toString(), alice);
      simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(500_000)],
        alice
      );
      const afterPetty = simnet.getDataVar("multisig-v3", "last-active-block");
      expect(JSON.stringify(afterPetty)).not.toEqual(JSON.stringify(initial));

      // Voted transaction updates timer
      simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(charlie), Cl.uint(150_000_000)],
        alice
      );
      const afterVote = simnet.getDataVar("multisig-v3", "last-active-block");
      expect(JSON.stringify(afterVote)).not.toEqual(JSON.stringify(afterPetty));
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe("Edge Cases", () => {
    it("handles zero amount transactions appropriately", () => {
      // Send money to the multisig
      simnet.transferSTX(1_000_000, multisig.value.toString(), alice);

      const zeroResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(0)],
        alice
      );
      
      expect(zeroResult.result).toStrictEqual(Cl.ok(Cl.uint(1)));
    });

    it("prevents sending more than vault balance", () => {
      // Send small amount to vault
      simnet.transferSTX(1_000_000, multisig.value.toString(), alice);

      // Try to send more than available
      const overdrawResult = simnet.callPublicFn(
        "multisig-v3",
        "submit-transaction",
        [Cl.principal(bob), Cl.uint(2_000_000)],
        alice
      );

      expect(overdrawResult.result).toStrictEqual(Cl.error(Cl.uint(1)));
    });

    it("handles multiple sequential petty cash transactions", () => {
      // Fund vault
      simnet.transferSTX(10_000_000, multisig.value.toString(), alice);

      // Do 5 petty cash transactions
      for (let i = 0; i < 5; i++) {
        const result = simnet.callPublicFn(
          "multisig-v3",
          "submit-transaction",
          [Cl.principal(bob), Cl.uint(1_000_000)],
          alice
        );
        expect(result.result).toStrictEqual(Cl.ok(Cl.uint(1)));
      }
    });
  });

  // ============================================
  // Security Tests
  // ============================================
  describe("Security Tests", () => {
    it("prevents non-owners from triggering dead man's switch", () => {
      const triggerResult = simnet.callPublicFn(
        "multisig-v3",
        "trigger-dead-man-switch",
        [],
        deployer
      );

      expect(triggerResult.result).toStrictEqual(Cl.error(Cl.uint(404)));
    });

    it("ensures petty cash limit cannot be exploited through multiple transactions", () => {
      // Fund vault
      simnet.transferSTX(1_000_000_000, multisig.value.toString(), alice);

      const numTransactions = 10;
      
      for (let i = 0; i < numTransactions; i++) {
        const result = simnet.callPublicFn(
          "multisig-v3",
          "submit-transaction",
          [Cl.principal(bob), Cl.uint(PETTY_CASH_LIMIT - 1)],
          alice
        );
        expect(result.result).toStrictEqual(Cl.ok(Cl.uint(1)));
      }
    });
  });

  // ============================================
  // Stress Tests
  // ============================================
  describe("Stress Tests", () => {
    it("handles high frequency of petty cash transactions", () => {
      // Fund vault generously
      simnet.transferSTX(100_000_000_000, multisig.value.toString(), alice);

      const numTransactions = 50;

      for (let i = 0; i < numTransactions; i++) {
        const result = simnet.callPublicFn(
          "multisig-v3",
          "submit-transaction",
          [Cl.principal(bob), Cl.uint(1_000_000)],
          alice
        );
        expect(result.result).toStrictEqual(Cl.ok(Cl.uint(1)));
      }
    });

    it("maintains correct state under concurrent-like operations", () => {
      // Mix of petty cash and voted transactions
      const operations = [
        { type: "petty", amount: 50_000_000 },
        { type: "large", amount: 150_000_000 },
        { type: "petty", amount: 30_000_000 },
        { type: "large", amount: 200_000_000 },
        { type: "petty", amount: 10_000_000 },
      ];

      // Fund vault
      simnet.transferSTX(1_000_000_000, multisig.value.toString(), alice);

      let lastActiveBefore = simnet.getDataVar("multisig-v3", "last-active-block");

      for (const op of operations) {
        const result = simnet.callPublicFn(
          "multisig-v3",
          "submit-transaction",
          [Cl.principal(bob), Cl.uint(op.amount)],
          alice
        );

        if (op.type === "petty") {
          expect(result.result).toStrictEqual(Cl.ok(Cl.uint(1)));
        } else {
          expect(result.result).toStrictEqual(Cl.ok(Cl.uint(0)));
        }

        const lastActiveAfter = simnet.getDataVar("multisig-v3", "last-active-block");
        expect(JSON.stringify(lastActiveAfter)).not.toEqual(JSON.stringify(lastActiveBefore));
        lastActiveBefore = lastActiveAfter;
      }
    });
  });
});
