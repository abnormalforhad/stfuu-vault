# Stacks Multisig

Multisig contract and tooling for Stacks. This project includes a Clarity
multisig contract that supports STX transfers and SIP-010 fungible token
transfers, a mock SIP-010 token for local testing, and a simple frontend
interface to simulate signer approvals and transaction execution flow.

## What is included

- `contracts/multisig-v3.clar`: multisig contract with signer set, threshold,
  transaction submission, and execution for STX or SIP-010 transfers.
- `contracts/mock-token-v3.clar`: SIP-010 compliant token used by tests.
- `tests/*.test.ts`: Clarinet-based tests for initialization, submission,
  signature validation, and execution paths.
- `frontend/`: static HTML/CSS/JS interface that models the multisig workflow.

## Quick start

1) Install dependencies
```
npm install
```

2) Run tests
```
npm test
```

3) Open the frontend
Open `frontend/index.html` in your browser.

## Contract behavior

- The deployer initializes the signer list and threshold once.
- A signer submits a transaction with type, amount, recipient, and optional
  token contract for SIP-010 transfers.
- A transaction executes only after a threshold of unique signer signatures is
  provided.
- Executed transactions cannot be replayed.

## Scripts

- `npm test`: run unit tests.
- `npm run test:report`: tests with coverage and costs.
- `npm run test:watch`: rerun on changes.
