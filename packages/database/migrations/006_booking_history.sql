-- Preserve existing rows and indexes. Receipts are issued records, never live views.
CREATE TRIGGER booking_history_immutable BEFORE UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
