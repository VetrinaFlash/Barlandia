-- Catalogo shop iniziale (8-10 arredi a tema bar/caffè, prezzi in Chicchi).
-- sprite_key corrisponde alle funzioni di disegno procedurale del client
-- (apps/web/src/game/sprites.ts). Sostituendo gli asset con un pack CC0,
-- basta mappare gli stessi sprite_key alle nuove texture.

INSERT INTO shop_items (id, name, price, sprite_key, category) VALUES
  ('sgabello',       'Sgabello di legno',      15,  'sgabello',       'seduta'),
  ('tavolino',       'Tavolino da bar',        30,  'tavolino',       'tavolo'),
  ('tavolino_tondo', 'Tavolino tondo',         35,  'tavolino_tondo', 'tavolo'),
  ('lampada',        'Lampada da tavolo',      25,  'lampada',        'luce'),
  ('insegna_neon',   'Insegna al neon',        90,  'insegna_neon',   'luce'),
  ('pianta',         'Pianta decorativa',      20,  'pianta',         'decoro'),
  ('runner',         'Runner terracotta',      10,  'runner',         'decoro'),
  ('jukebox',        'Jukebox anni ''50',      120, 'jukebox',        'gioco'),
  ('biliardino',     'Biliardino',             150, 'biliardino',     'gioco'),
  ('freccette',      'Bersaglio freccette',    45,  'freccette',      'gioco');
