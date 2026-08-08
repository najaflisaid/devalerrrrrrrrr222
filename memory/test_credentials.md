# Test Credentials (De Valeur)

## Test Customer (created during iteration_11 retry-payment test)
- **Phone**: +994 55 306 27 75 (raw: 553062775)
- **Password**: test1234
- **Name**: TestRetry User
- **Firestore userId**: 5aC46xfnJ0OtpvrZ38BVVvwR6GC3
- **Firebase login email (synthetic)**: phone994553062775@devaleur.az
- **Pending order**: zrgROExuDyfzzCAsCq7y (Sifariş #38454329, 232 AZN, "Rivet Flame Design")

## Login flow
1. Cart page → checkout → "Hesabım var" (I have account) tab → phone + password
2. OR direct Firebase signInWithEmailAndPassword with synthetic email above

## Zəmanət Servisi (Warranty) — added
- Customer flow verified with the test customer above (phone 553062775 / test1234).
- Firestore collection: `warranty_services`.
- Branches source: `worker_branches` (3 exist: Karvan Mall Sumqayıt, Sülh Sumqayıt, Azadlıq Pr. Bakı).
- Test artifact: Akt №6626154 (doc id CgVdxZOJz8Q0llX0qiCV) — safe to delete from admin panel.
- ADMIN account: NOT available in this file. Admin login (/admin-login) needs a Firestore user with role='admin'. Provide admin phone/email+password to verify the admin-side warranty flow (accept → status → pickup).
