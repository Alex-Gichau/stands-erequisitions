# Security Specification for Fintech Requisitions

## Data Invariants
- A `Requisition` must have a valid `requesterId` matching the current user's UID.
- Only users with `APPROVER_L1`, `APPROVER_L2`, or `ADMIN` roles can update a requisition's status to their respective approval level.
- `Project` budgets can only be updated by `ADMIN` or through system-triggered spent amount increments upon approval.
- `UserProfile` role and approval status can only be modified by an `ADMIN`.
- New users are created with `isApproved: false` and `role: CHURCH_GROUP` by default (enforced by rules).

## The Dirty Dozen Payloads
1. **Unauthorized Status Jump**: A `CHURCH_GROUP` user trying to set a requisition to `APPROVED_L1`.
2. **Identity Spoofing**: User A creating a requisition with `requesterId` of User B.
3. **Privilege Escalation**: A new user setting their own `role` to `ADMIN` during creation.
4. **Budget Sabotage**: A non-admin user modifying a `Project`'s `allocatedBudget`.
5. **Ghost Field Injection**: Adding a secondary `isVerified` field to a requisition to bypass future filters.
6. **Orphaned Requisition**: Creating a requisition for a non-existent `projectId`.
7. **Approval By Note Spoofing**: An L1 approver adding an approval note pretending to be an L2 approver.
8. **Suspended Access Bypass**: A user who is `isSuspended: true` trying to read any data.
9. **Large Request Flooding**: Creating 1000 requisitions in a batch (size limits on IDs and strings).
10. **Timestamp Faking**: Setting `submittedAt` to a future date instead of `request.time`.
11. **Deleted Audit Trail**: Attempting to delete a requisition that has already been `APPROVED_L1`.
12. **PII Leak**: A `CHURCH_GROUP` user trying to list all `users`.

## Test Runner Logic (Firestore Rules Test)
The `firestore.rules` will be validated to deny all the above.
