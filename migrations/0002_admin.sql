-- Adminsidan (/admin): Marie redigerar sina tider själv.

-- Inställningar som JSON per nyckel. Raden 'schema' håller veckoschemat,
-- undantag för enstaka datum och hur långt fram det går att boka. Saknas
-- raden gäller src/tillganglighet.json.
CREATE TABLE installningar (
  nyckel  TEXT PRIMARY KEY,
  varde   TEXT NOT NULL,
  andrad  INTEGER NOT NULL             -- unixtid (s)
);

-- Misslyckade inloggningar, för att kunna spärra den som gissar lösenord.
CREATE TABLE inloggningsforsok (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  ip   TEXT NOT NULL,
  tid  INTEGER NOT NULL                -- unixtid (s)
);
CREATE INDEX inloggningsforsok_tid ON inloggningsforsok (tid);

-- bokningar.status får ett värde till, utan schemaändring:
--   avbokad  Marie har avbokat i adminsidan; tiden är ledig igen.
--            Återbetalningen görs för hand i Stripe.
