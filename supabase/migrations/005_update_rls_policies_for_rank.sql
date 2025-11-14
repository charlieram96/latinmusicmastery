-- Update RLS policies to use rank instead of subscription status
-- This simplifies queries and improves performance

-- Drop existing lesson access policy
DROP POLICY IF EXISTS "Users can view lessons based on subscription" ON lessons;

-- Create new lesson access policy using rank
CREATE POLICY "Users can view lessons based on rank"
ON lessons FOR SELECT
TO authenticated
USING (
  is_free = true
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.rank = 'student' OR profiles.is_admin = true)
  )
);

-- Drop existing exercise access policy
DROP POLICY IF EXISTS "Users can view exercises based on lesson access" ON exercises;

-- Create new exercise access policy using rank
CREATE POLICY "Users can view exercises based on rank"
ON exercises FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lessons
    WHERE lessons.id = exercises.lesson_id
    AND (
      lessons.is_free = true
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.rank = 'student' OR profiles.is_admin = true)
      )
    )
  )
);

-- Comment for documentation
COMMENT ON POLICY "Users can view lessons based on rank" ON lessons IS 'Allow access to free lessons or paid lessons for students and admins';
COMMENT ON POLICY "Users can view exercises based on rank" ON exercises IS 'Allow access to exercises if user can access the parent lesson';
