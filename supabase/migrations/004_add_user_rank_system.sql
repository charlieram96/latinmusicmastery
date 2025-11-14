-- Add rank field to profiles table
-- member: user with no active subscription
-- student: user with active subscription

ALTER TABLE profiles
ADD COLUMN rank TEXT NOT NULL DEFAULT 'member';

-- Add check constraint to ensure valid rank values
ALTER TABLE profiles
ADD CONSTRAINT profiles_rank_check CHECK (rank IN ('member', 'student'));

-- Add index for faster rank queries
CREATE INDEX profiles_rank_idx ON profiles(rank);

-- Create function to update user rank based on subscription status
CREATE OR REPLACE FUNCTION update_user_rank()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription is being created or updated
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Set rank to 'student' if subscription is active
    IF NEW.status = 'active' THEN
      UPDATE profiles
      SET rank = 'student', updated_at = NOW()
      WHERE id = NEW.user_id;
    -- Set rank to 'member' if subscription is not active
    ELSE
      UPDATE profiles
      SET rank = 'member', updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  -- If subscription is being deleted
  IF (TG_OP = 'DELETE') THEN
    UPDATE profiles
    SET rank = 'member', updated_at = NOW()
    WHERE id = OLD.user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update rank when subscription changes
DROP TRIGGER IF EXISTS update_user_rank_trigger ON subscriptions;
CREATE TRIGGER update_user_rank_trigger
  AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_rank();

-- Update existing users with active subscriptions to 'student' rank
UPDATE profiles
SET rank = 'student'
WHERE id IN (
  SELECT user_id
  FROM subscriptions
  WHERE status = 'active'
);

-- Comment for documentation
COMMENT ON COLUMN profiles.rank IS 'User rank: member (no subscription) or student (active subscription)';
