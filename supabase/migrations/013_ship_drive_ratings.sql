alter table ships
  add column if not exists jump_rating           smallint,
  add column if not exists maneuver_drive_rating smallint;
