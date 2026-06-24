-- Raise the course-videos bucket upload limit from 500MB to 1GB.
-- Lesson videos and exercise videos (watch/play parts) all upload to this bucket.
-- 1073741824 = 1024 * 1024 * 1024 (1GB). Previous value was 524288000 (500MB).
update storage.buckets
set file_size_limit = 1073741824
where id = 'course-videos';
