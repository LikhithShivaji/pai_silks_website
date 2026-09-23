-- 012_user_address_parts.sql
--
-- Split the customer's saved address into the parts a courier label actually
-- needs.
--
-- `master_user.address` is a single free-text TEXT column, so the account held
-- "the whole address" as one blob while CHECKOUT has always collected street,
-- apartment, city, state and pincode as separate fields. That asymmetry meant
-- the signup address could never prefill the checkout form properly: there is
-- no reliable way to split one typed string back into five fields, and guessing
-- wrong puts a pincode in the state box.
--
-- NULLABLE, deliberately. The 22 existing customers signed up before these
-- fields existed and nobody holds that data for them — NOT NULL would need a
-- backfill of information that does not exist, and inventing it is worse than
-- leaving it absent. New signups are required to supply all four at the
-- APPLICATION layer (validators.signup), which is the correct place for a rule
-- that applies to new rows but cannot be applied retroactively.
--
-- Widths follow what the data actually is: Indian PIN codes are exactly 6
-- digits, so VARCHAR(10) leaves room without pretending a PIN is a number —
-- leading zeros matter and arithmetic on one is meaningless.

ALTER TABLE master_user
  ADD COLUMN city    VARCHAR(100) NULL AFTER address,
  ADD COLUMN state   VARCHAR(100) NULL AFTER city,
  ADD COLUMN pincode VARCHAR(10)  NULL AFTER state;
