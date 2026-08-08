-- Week 1 Day 6: raw SQL joins, written by hand against the seeded data.
-- Run with: docker exec -i consultation-booking-db-1 psql -U postgres -d consultation < api/sql/day6-joins.sql

-- 1. Consultants joined with their specialties.
-- consultant_profiles and specialties have no direct foreign key between
-- them - they're related many-to-many through consultant_specialties, so
-- getting from one to the other takes two JOINs: profile -> junction row
-- -> specialty. This INNER JOIN produces one row per (consultant,
-- specialty) PAIR, so a consultant with 2 specialties appears twice.
SELECT
  u.email,
  cp.headline,
  s.name AS specialty
FROM consultant_profiles cp
JOIN users u ON u.id = cp.user_id
JOIN consultant_specialties cs ON cs.consultant_id = cp.id
JOIN specialties s ON s.id = cs.specialty_id
ORDER BY u.email, s.name;

-- 2. Same relationship, collapsed to one row per consultant.
-- LEFT JOIN instead of JOIN: a consultant with zero specialties would
-- vanish entirely from an INNER JOIN (there's no matching junction row to
-- join against), but should still show up here. GROUP BY collapses the
-- fan-out from query 1 back down, and string_agg concatenates the
-- specialty names that grouped together instead of losing them.
SELECT
  u.email,
  cp.headline,
  COALESCE(string_agg(s.name, ', ' ORDER BY s.name), '(none)') AS specialties
FROM consultant_profiles cp
JOIN users u ON u.id = cp.user_id
LEFT JOIN consultant_specialties cs ON cs.consultant_id = cp.id
LEFT JOIN specialties s ON s.id = cs.specialty_id
GROUP BY u.email, cp.headline
ORDER BY u.email;

-- 3. Appointment counts per consultant.
-- Same LEFT JOIN reasoning as query 2, for the same reason: right now (Week
-- 1, before booking exists) every consultant has zero appointments. An
-- INNER JOIN would drop every single consultant from the result, since
-- none of them have a matching appointments row yet. FILTER lets one
-- COUNT() aggregate answer three different questions in a single pass
-- over the joined rows, instead of three separate queries.
SELECT
  u.email,
  cp.headline,
  COUNT(a.id) AS total_appointments,
  COUNT(a.id) FILTER (WHERE a.status = 'confirmed') AS confirmed_appointments,
  COUNT(a.id) FILTER (WHERE a.status = 'cancelled') AS cancelled_appointments
FROM consultant_profiles cp
JOIN users u ON u.id = cp.user_id
LEFT JOIN appointments a ON a.consultant_id = cp.id
GROUP BY u.email, cp.headline
ORDER BY u.email;
