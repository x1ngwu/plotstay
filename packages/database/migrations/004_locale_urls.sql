-- Public URL identity is separate from the immutable language keys in history.
ALTER TABLE locales ADD COLUMN path_prefix text, ADD COLUMN language_tag text;
UPDATE locales SET path_prefix = CASE WHEN code='zh-CN' THEN 'zh' ELSE lower(code) END,
  language_tag = CASE WHEN code='zh-CN' THEN 'zh-Hans' ELSE code END;

-- Keep existing INSERT(code,name) integrations compatible. Explicit mappings are
-- preferred for new languages (e.g. zh-hant / zh-Hant).
CREATE FUNCTION locale_url_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.path_prefix := coalesce(NEW.path_prefix, lower(NEW.code));
  NEW.language_tag := coalesce(NEW.language_tag, NEW.code);
  RETURN NEW;
END $$;
CREATE TRIGGER locale_url_defaults BEFORE INSERT ON locales
  FOR EACH ROW EXECUTE FUNCTION locale_url_defaults();
ALTER TABLE locales ALTER COLUMN path_prefix SET NOT NULL, ALTER COLUMN language_tag SET NOT NULL;
ALTER TABLE locales ADD CONSTRAINT locale_path_format CHECK
  (path_prefix ~ '^[a-z]{2,8}(-[a-z0-9]{1,8})*$' AND path_prefix NOT IN ('api','worlds'));
ALTER TABLE locales ADD CONSTRAINT locale_tag_format CHECK (language_tag ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$');
CREATE UNIQUE INDEX locale_path_unique ON locales(path_prefix);
CREATE UNIQUE INDEX locale_tag_unique ON locales(lower(language_tag));
