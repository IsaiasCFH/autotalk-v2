
CREATE TEMP TABLE tmp_client (
  id integer,
  name text,
  "phoneNumber" text,
  "createAt" timestamptz,
  email text
);
CREATE TEMP TABLE tmp_executive (
  id integer,
  name text,
  email text,
  role text,
  "createAt" timestamptz
);
CREATE TEMP TABLE tmp_assign (
  id integer,
  name text,
  "phoneNumber" text,
  executive_id integer
);
CREATE TEMP TABLE tmp_conversation (
  id integer,
  client_id integer,
  assign_executive_twilio_id integer,
  "createAt" timestamptz,
  "updateAt" timestamptz,
  type text,
  channel_number text
);
CREATE TEMP TABLE tmp_message (
  id integer,
  content text,
  "messageType" text,
  "createAt" timestamptz,
  "conversationId" integer,
  aditional_id text
);
\COPY tmp_client FROM '/opt/autotalk/client.csv' CSV HEADER ENCODING 'UTF8';
\COPY tmp_executive FROM '/opt/autotalk/executive.csv' CSV HEADER ENCODING 'UTF8';
\COPY tmp_assign FROM '/opt/autotalk/assign_executive_twilio.csv' CSV HEADER ENCODING 'UTF8';
\COPY tmp_conversation FROM '/opt/autotalk/conversation.csv' CSV HEADER ENCODING 'UTF8';
\COPY tmp_message FROM '/opt/autotalk/message.csv' CSV HEADER ENCODING 'UTF8';
CREATE TEMP TABLE map_client (old_id integer, new_id text);
CREATE TEMP TABLE map_conversation (old_id integer, new_id text);
INSERT INTO map_client (old_id, new_id) SELECT id, gen_random_uuid()::text FROM tmp_client;
INSERT INTO contacts (id, phone, name, "isBlocked", "createdAt", "updatedAt")
SELECT m.new_id, COALESCE(NULLIF(TRIM(c."phoneNumber"), ''), 'sin_telefono_' || c.id), COALESCE(NULLIF(TRIM(c.name), ''), 'Sin nombre'), false, COALESCE(c."createAt", NOW()), COALESCE(c."createAt", NOW())
FROM tmp_client c JOIN map_client m ON m.old_id = c.id ON CONFLICT (phone) DO NOTHING;
INSERT INTO map_conversation (old_id, new_id) SELECT id, gen_random_uuid()::text FROM tmp_conversation;
INSERT INTO conversations (id, department, "isOpen", "createdAt", "updatedAt", "contactId", "agentId", "numberId")
SELECT mc.new_id, 'COBRANZA'::"Department", false, COALESCE(cv."createAt", NOW()), COALESCE(cv."updateAt", cv."createAt", NOW()),
COALESCE((SELECT new_id FROM map_client WHERE old_id = cv.client_id), (SELECT id FROM contacts WHERE phone = (SELECT "phoneNumber" FROM tmp_client WHERE id = cv.client_id) LIMIT 1)),
(SELECT a.id FROM agents a JOIN tmp_executive te ON LOWER(te.email) = LOWER(a.email) JOIN tmp_assign ta ON ta.executive_id = te.id WHERE ta.id = cv.assign_executive_twilio_id LIMIT 1),
COALESCE((SELECT id FROM whatsapp_numbers WHERE number LIKE '%' || REPLACE(COALESCE(cv.channel_number,''), '+', '') || '%' LIMIT 1), 'cmpmnt3uo0000usu1ddg8jcmo')
FROM tmp_conversation cv JOIN map_conversation mc ON mc.old_id = cv.id
WHERE EXISTS (SELECT 1 FROM map_client WHERE old_id = cv.client_id);
INSERT INTO messages (id, content, "fromContact", status, "whatsappId", "createdAt", "conversationId")
SELECT gen_random_uuid()::text, COALESCE(NULLIF(TRIM(m.content), ''), '[sin contenido]'),
CASE WHEN LOWER(COALESCE(m."messageType",'')) IN ('incoming','received','inbound') THEN true ELSE false END,
'DELIVERED'::"MessageStatus", m.aditional_id, COALESCE(m."createAt", NOW()), mc.new_id
FROM tmp_message m JOIN map_conversation mc ON mc.old_id = m."conversationId" WHERE mc.new_id IS NOT NULL;
SELECT 'contacts' as tabla, COUNT(*) as total FROM contacts WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations WHERE "createdAt" >= NOW() - INTERVAL '1 hour'
UNION ALL SELECT 'messages', COUNT(*) FROM messages WHERE "createdAt" >= NOW() - INTERVAL '1 hour';
