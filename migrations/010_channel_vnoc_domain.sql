USE appchat;

-- A channel can be linked to a VNOC domain (e.g. #zipsite → zipsite.com): its team can be imported,
-- and the Sprints panel in that channel defaults to that domain.
ALTER TABLE channels
  ADD COLUMN vnoc_domain VARCHAR(255) DEFAULT NULL;
