;; --------------------------------------------------------------------------
;; STFUU VAULT LOGIC
;; --------------------------------------------------------------------------

(define-constant PETTY-CASH-LIMIT u100000000) ;; 100 STX limit for instant send
(define-data-var last-active-block uint u0)   ;; Tracks the last time we moved money
(define-constant INACTIVITY-LIMIT u52560)     ;; ~1 Year (in blocks)
(define-constant BACKUP-BENEFICIARY 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) ;; CHANGE THIS TO YOUR BACKUP ADDRESS

;; The Upgraded "Submit" Function
(define-public (submit-transaction (dest principal) (amount uint))
    (begin
        ;; 1. Check if the person calling this is actually an owner
        (asserts! (is-some (index-of? (var-get owners) tx-sender)) (err u100))

        ;; 2. Update the "Dead Man" timer (We are alive!)
        (var-set last-active-block block-height)

        ;; 3. THE "PETTY CASH" CHECK
        ;; If amount is SMALL, we skip the voting and send it immediately.
        (if (< amount PETTY-CASH-LIMIT)
            (begin 
                ;; "Shut up and send it" logic
                (try! (as-contract (stx-transfer? amount tx-sender dest)))
                (ok u1) ;; Return success code
            )
            ;; ELSE: If it's a big amount, use standard voting logic
            (add-transaction dest amount)
        )
    )
)

;; The "Dead Man's Switch" Function
(define-public (trigger-dead-man-switch)
    (begin
        ;; Check if 1 year has passed since last activity
        (asserts! (> block-height (+ (var-get last-active-block) INACTIVITY-LIMIT)) (err u404))
        
        ;; Empty the WHOLE vault to the backup address
        (as-contract (stx-transfer? (stx-get-balance tx-sender) tx-sender BACKUP-BENEFICIARY))
    )
)