-- Compás analytics events. A single thin table where the player + admin
-- UI logs noteworthy interactions for the cutover dashboard. Read by
-- /admin/compas/audit.
CREATE TABLE IF NOT EXISTS compas_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  class_item_id UUID REFERENCES class_items(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compas_events_type_created
  ON compas_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compas_events_class_item
  ON compas_events(class_item_id, created_at DESC) WHERE class_item_id IS NOT NULL;

ALTER TABLE compas_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compas_events_insert_authenticated"
  ON compas_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "compas_events_admin_read"
  ON compas_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
