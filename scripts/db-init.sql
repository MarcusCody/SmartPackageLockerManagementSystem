-- Separate database for the adapter integration tests, so TRUNCATE-happy
-- tests never touch development data.
CREATE DATABASE smartlocker_test;
