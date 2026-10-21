-- En rad per bokningsförsök. status:
--   reserverad  tiden hålls medan paret betalar (till giltig_till)
--   bokad       betald och klar
--   slappt      betalningen avbröts eller gick ut; tiden är ledig igen
--   krock       betald men tiden hann tas av någon annan; Marie återbetalar
CREATE TABLE bokningar (
  id             TEXT PRIMARY KEY,
  datum          TEXT NOT NULL,          -- ÅÅÅÅ-MM-DD
  tid            TEXT NOT NULL,          -- 14.00
  status         TEXT NOT NULL,
  namn           TEXT NOT NULL,
  epost          TEXT NOT NULL,
  telefon        TEXT NOT NULL,
  sprak          TEXT NOT NULL,
  om_oss         TEXT NOT NULL DEFAULT '',
  inspelning     TEXT NOT NULL,          -- ja | nej
  avbryt_nyckel  TEXT NOT NULL,
  stripe_session TEXT,
  giltig_till    INTEGER NOT NULL,       -- unixtid (s)
  skapad         INTEGER NOT NULL,
  bokad          INTEGER
);

-- Högst en aktiv bokning per tid: databasen nekar dubbelbokning även om
-- två par trycker på betala exakt samtidigt.
CREATE UNIQUE INDEX en_aktiv_per_tid ON bokningar (datum, tid)
  WHERE status IN ('reserverad', 'bokad');

CREATE INDEX bokningar_session ON bokningar (stripe_session);
