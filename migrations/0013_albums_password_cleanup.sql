-- 0013_albums_password_cleanup.sql：清空 albums.password_hint 存量明文口令
--
-- 背景：password_hint 列原被用于冗余存储相册访问口令明文（D1 泄露即口令泄露，
-- 使 album_passwords 的 AES-GCM 加密形同虚设）。口令权威源为 album_passwords
-- 加密表；自代码修复后 password_hint 恒写 NULL、读取经加密表解密回填（编辑回显）。
--
-- 本迁移清空存量明文（不可逆；迁移前请备份 D1）：
--   回滚：password_hint 明文无法恢复（口令仍可从 album_passwords 解密回显），
--         如需回滚仅需撤销代码修复并保留本列结构，无数据可还原。
UPDATE albums SET password_hint = NULL WHERE password_hint IS NOT NULL;
