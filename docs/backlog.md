# Backlog — SDG Parchi Val di Cornia

**Cliente**: Parchi Val di Cornia S.p.A.
**Obiettivo**: Sistema automatico di estrazione dati da determine amministrative PDF per la compilazione del Modulo d'Ordine.

---

# EP-001: Estrazione intelligente dei dati da determina

## User Persona
Come Marco Gasperini (Responsabile Area Amministrativa), voglio che il sistema legga automaticamente una determina in PDF ed estragga i dati strutturati necessari, perché oggi la compilazione manuale del Modulo d'Ordine richiede tempo, è soggetta a errori di trascrizione e non è scalabile con l'aumento del volume delle determine.

## Contesto
Parchi Val di Cornia emette regolarmente determine amministrative di affidamento in formato PDF. Da ciascuna determina occorre estrarre un insieme definito di campi (numero, data, CIG, fornitore, importo, imputazioni contabili, ruoli) per popolare il Modulo d'Ordine. Lo schema JSON di riferimento è stato definito e validato su 6 determine reali. Alcune determine sono PDF nativi digitali, altre sono scansioni; alcune hanno imputazione singola, altre multipla; alcune sono pluriennali.

## Obiettivo
Dato un PDF di una determina, il sistema produce un oggetto JSON valido e completo secondo lo schema concordato, senza intervento umano per i campi presenti nel documento.

## Non-obiettivi
- Non compilare i campi che non esistono nella determina (es. codice fornitore, P.IVA): restano `null`
- Non generare il Modulo d'Ordine finale (quello è fuori scope di questa epica)
- Non gestire determine in formato diverso da PDF

## Criteri di accettazione
- [ ] Dato il PDF di Det 08, il JSON prodotto corrisponde campo per campo al JSON di riferimento in `output/determine.json`
- [ ] PDF scansionato (immagine) viene processato correttamente usando le capacità vision di Claude
- [ ] Imputazioni multiple vengono estratte come array con una voce per ciascun centro di costo
- [ ] Determina pluriennale popola correttamente `importo_annuale`, `numero_anni` e `imponibile_totale`
- [ ] Campi non presenti nella determina risultano `null` nel JSON, mai stringa vuota
- [ ] Il campo `referente_affidamento` è `null` se non esplicitato nella determina
- [ ] La `base_normativa` riporta la lettera corretta (lett. a) per lavori, lett. b) per servizi/forniture)

## Storie

### ST-001.01: Estrazione testo da PDF nativo digitale

**Come** sistema di estrazione,
**voglio** leggere il testo di un PDF digitale pagina per pagina,
**perché** è la modalità più veloce ed economica per passare il contenuto a Claude.

**Criteri di accettazione:**
- [ ] Il testo di tutte le pagine viene concatenato in un'unica stringa
- [ ] Se il testo estratto supera i 500 caratteri, viene usato il flusso testo (non vision)
- [ ] Il nome del file viene preservato come `fonte_file` nel JSON

**Note tecniche:**
- Libreria: `pypdf`
- Soglia testo minimo: 500 caratteri (sotto questa soglia → fallback a vision)

---

### ST-001.02: Estrazione dati da PDF scansionato (vision)

**Come** sistema di estrazione,
**voglio** convertire le pagine di un PDF scansionato in immagini e passarle a Claude come contenuto vision,
**perché** alcuni PDF delle determine sono scansioni e non contengono testo estraibile.

**Criteri di accettazione:**
- [ ] Ogni pagina del PDF viene convertita in immagine PNG a 150 DPI
- [ ] Le immagini vengono codificate in base64 e passate a Claude come blocchi `image`
- [ ] Il risultato è lo stesso schema JSON del flusso testo
- [ ] Funziona correttamente con `Det 08` (nativo) e con eventuali PDF scansionati

**Note tecniche:**
- Libreria: `pdf2image` (richiede `poppler-utils` nel container Docker)
- Risoluzione: 150 DPI (bilanciamento qualità/dimensione payload)
- Formato immagine: PNG, base64

---

### ST-001.03: Chiamata a Claude su AWS Bedrock e parsing risposta

**Come** sistema di estrazione,
**voglio** inviare il contenuto della determina a Claude su Bedrock con un prompt strutturato e ricevere il JSON,
**perché** Claude è il motore di comprensione del linguaggio burocratico italiano e di estrazione semantica dei campi.

**Criteri di accettazione:**
- [ ] Il prompt include lo schema JSON completo come riferimento
- [ ] La risposta contiene esclusivamente JSON valido (nessun testo aggiuntivo)
- [ ] Il JSON viene validato con Pydantic contro `DeterminaSchema`
- [ ] In caso di throttling Bedrock, viene applicato retry con backoff esponenziale (max 3 tentativi)
- [ ] In caso di JSON non parsabile, viene loggato l'errore e sollevata eccezione con dettaglio

**Note tecniche:**
- Client: `boto3` `bedrock-runtime`, region `eu-west-1`
- Model ID: `eu.anthropic.claude-sonnet-4-5`
- Credenziali: da `~/.aws/credentials` (montato come volume read-only)
- Prompt system: vedi sezione Note tecniche EP-001
- `max_tokens`: 4096

**Prompt di estrazione (system):**
```
Sei un estrattore di dati da determine amministrative italiane emesse da Parchi Val di Cornia S.p.A.
Estrai i dati e restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo.
Segui questo schema:
{schema}
Regole:
- Se un campo non è presente nel documento usa null, mai stringa vuota
- Per le imputazioni multiple crea un array con una voce per ciascun centro di costo
- Per determine pluriennali popola importo_annuale, numero_anni e imponibile_totale (annuale × anni)
- base_normativa: usa "art. 50 c. 1, lett. a) D.Lgs. 36/2023" per lavori, "lett. b)" per servizi e forniture
- referente_affidamento: null se non esplicitamente indicato come tale nel documento
```

---

## Note tecniche (EP-001)
- Stack: Python 3.12, `pypdf`, `pdf2image`, `boto3`, `pydantic`
- Il servizio di estrazione è stateless: riceve bytes del PDF, restituisce dict Python
- Lo schema Pydantic `DeterminaSchema` è la fonte di verità per la struttura JSON
- Il campo `fonte_file` viene sempre popolato con il nome originale del file

## Impatto su epiche esistenti
Nessuna epica precedente — questa è la prima.

---

# EP-002: API REST e persistenza delle determine

## User Persona
Come Marco Gasperini (Responsabile Area Amministrativa), voglio poter inviare una determina via API e ritrovare i dati estratti in qualsiasi momento, perché ho bisogno di un archivio digitale consultabile e di un'interfaccia programmatica per integrare il sistema con altri strumenti aziendali.

## Contesto
L'estrazione sviluppata in EP-001 deve essere esposta come servizio HTTP. Il sistema deve gestire sia l'upload manuale di singoli PDF che il processing in batch di PDF provenienti da un bucket Google Cloud Storage. Tutti i risultati devono essere persistiti su database per consentire consultazione, modifica e export in qualsiasi momento successivo.

## Obiettivo
Il backend espone endpoint REST documentati che coprono l'intero ciclo di vita di una determina: upload → estrazione → salvataggio → lettura → modifica → export → eliminazione.

## Non-obiettivi
- Non esporre credenziali AWS o GCS negli endpoint
- Non implementare autenticazione/autorizzazione (fuori scope in questa fase)
- Non generare il Modulo d'Ordine compilato (è il passo successivo al JSON)

## Criteri di accettazione
- [ ] `POST /api/extract` riceve un PDF, restituisce il JSON estratto e l'UUID del record salvato
- [ ] `POST /api/bulk` riceve un path GCS, processa tutti i PDF nella cartella, restituisce array JSON
- [ ] `GET /api/determine` restituisce lista paginata con campi chiave (numero, data, fornitore, importo)
- [ ] `GET /api/determine/{id}` restituisce il JSON completo della determina
- [ ] `PUT /api/determine/{id}` salva le modifiche manuali e aggiorna `updated_at`
- [ ] `DELETE /api/determine/{id}` rimuove il record
- [ ] `GET /api/determine/{id}/export` scarica il JSON come file
- [ ] `GET /api/determine/export` scarica un array JSON di tutte le determine (o di quelle selezionate via query param `ids`)
- [ ] Documentazione Swagger disponibile su `/docs`

## Storie

### ST-002.01: Upload e estrazione singola determina

**Come** utente API,
**voglio** inviare un file PDF con POST multipart e ricevere il JSON estratto,
**perché** è il caso d'uso principale del sistema.

**Criteri di accettazione:**
- [ ] Endpoint accetta `multipart/form-data` con campo `file`
- [ ] Risposta include `id` (UUID), `fonte_file`, e il JSON completo della determina
- [ ] Il record viene salvato su DB con `source = "upload"`
- [ ] Errori (PDF non leggibile, Bedrock non raggiungibile) restituiscono HTTP 422 o 503 con messaggio leggibile

**Note tecniche:**
- Router: `POST /api/extract`
- Usa il servizio di estrazione di EP-001
- Salva su tabella `determine` con `raw_json` di tipo JSONB

---

### ST-002.02: Processing bulk da Google Cloud Storage

**Come** sistema di automazione,
**voglio** che il backend scarichi tutti i PDF da un path GCS e li processi in sequenza,
**perché** le determine vengono depositate su bucket GCS e devo poterle elaborare in batch senza caricarle una per una.

**Criteri di accettazione:**
- [ ] Endpoint accetta `{"gcs_path": "gs://bucket/folder"}` in body JSON
- [ ] Scarica tutti i file `.pdf` presenti nel path GCS
- [ ] Processa ogni PDF con il servizio EP-001 e salva i risultati con `source = "gcs_bulk"`
- [ ] Restituisce array JSON con tutti i risultati (inclusi eventuali errori per-file)
- [ ] Un errore su un singolo PDF non blocca il processing degli altri

**Note tecniche:**
- Router: `POST /api/bulk`
- Client GCS: `google-cloud-storage`, credenziali da service account (variabile d'ambiente `GOOGLE_APPLICATION_CREDENTIALS`)
- Elaborazione sequenziale (non parallela) per evitare throttling Bedrock

---

### ST-002.03: CRUD e export delle determine

**Come** utente API,
**voglio** poter leggere, modificare, esportare ed eliminare le determine salvate,
**perché** ho bisogno di correggere errori di estrazione e di scaricare i dati in formato JSON.

**Criteri di accettazione:**
- [ ] `GET /api/determine?page=1&size=20` restituisce lista paginata
- [ ] `GET /api/determine/{id}` restituisce record completo
- [ ] `PUT /api/determine/{id}` accetta il JSON modificato, aggiorna `raw_json` e `updated_at`
- [ ] `DELETE /api/determine/{id}` restituisce HTTP 204
- [ ] `GET /api/determine/{id}/export` restituisce file `determina_{numero}_{data}.json`
- [ ] `GET /api/determine/export?ids=uuid1,uuid2` restituisce array JSON come file scaricabile

**Note tecniche:**
- Router: `determina.py`
- ORM: SQLAlchemy 2.0, modello `Determina`

---

## Note tecniche (EP-002)
- Framework: FastAPI 0.115, Python 3.12
- DB: PostgreSQL 16, accesso via SQLAlchemy 2.0
- Schema tabella `determine`: `id UUID PK`, `fonte_file TEXT`, `raw_json JSONB`, `source ENUM`, `created_at TIMESTAMP`, `updated_at TIMESTAMP`
- Migrazioni: Alembic
- CORS: abilitato per `http://localhost:3000` in sviluppo

## Impatto su epiche esistenti
Dipende da EP-001 (usa il servizio di estrazione). Nessuna modifica a EP-001.

---

# EP-003: Frontend per operazioni manuali

## User Persona
Come Amministratore (operatore interno di Parchi Val di Cornia), voglio poter caricare una determina dal browser, vedere immediatamente i dati estratti, correggerli se necessario ed esportare il JSON finale, perché non posso usare API tecniche e ho bisogno di uno strumento semplice per gestire i casi che richiedono intervento umano.

## Contesto
Non tutti gli utenti di Parchi Val di Cornia hanno competenze tecniche per usare le API direttamente. Il frontend serve come interfaccia accessibile per le operazioni manuali: upload, revisione, correzione ed export. Deve anche offrire uno storico di tutte le determine processate.

## Obiettivo
Un'interfaccia web accessibile da browser che copre l'intero flusso: carica PDF → visualizza JSON estratto → correggi se necessario → esporta. Con storico consultabile.

## Non-obiettivi
- Non replicare funzionalità già coperte dalle API (il frontend è un client, non logica aggiuntiva)
- Non implementare autenticazione in questa fase
- Non gestire il processo di generazione del Modulo d'Ordine compilato

## Criteri di accettazione
- [ ] Pagina Upload: drag & drop di uno o più PDF, progress durante l'estrazione, preview del JSON risultante
- [ ] Pagina History: tabella con numero determina, data, fornitore, importo totale, data processing, azioni
- [ ] Pagina Detail: tutti i campi editabili in form, sezione imputazioni con aggiunta/rimozione voci, pulsante salva e pulsante export
- [ ] Export JSON scaricabile sia dalla pagina Detail (singola) che dalla pagina History (selezione multipla)
- [ ] Interfaccia responsiva e utilizzabile su desktop

## Storie

### ST-003.01: Pagina Upload

**Come** Amministratore,
**voglio** trascinare uno o più PDF nella pagina e vedere i risultati dell'estrazione,
**perché** è il punto di ingresso principale del sistema per l'uso manuale.

**Criteri di accettazione:**
- [ ] Area drag & drop visibile e funzionante, con fallback click-to-browse
- [ ] Progress bar o spinner durante l'elaborazione
- [ ] Per ogni file processato, mostra anteprima del JSON estratto (collassabile)
- [ ] Errori per singolo file visualizzati inline senza bloccare gli altri upload
- [ ] Pulsante "Vai allo storico" dopo il completamento

---

### ST-003.02: Pagina History (storico)

**Come** Amministratore,
**voglio** vedere tutte le determine già processate in una tabella,
**perché** devo poter ritrovare, riesaminare ed esportare dati estratti in precedenza.

**Criteri di accettazione:**
- [ ] Tabella con colonne: N° determina, Data, Fornitore, Importo, Processata il, Azioni
- [ ] Azioni per riga: Dettaglio, Export JSON, Elimina
- [ ] Selezione multipla con checkbox per export batch
- [ ] Paginazione (20 record per pagina)
- [ ] Ordinamento per data determina (default: più recente prima)

---

### ST-003.03: Pagina Detail (visualizzazione e editing)

**Come** Amministratore,
**voglio** visualizzare e correggere i dati estratti da una determina,
**perché** l'estrazione automatica può contenere imprecisioni che devo poter correggere prima dell'export.

**Criteri di accettazione:**
- [ ] Tutti i campi della determina visualizzati in form editabile
- [ ] Sezione imputazioni: lista di voci con possibilità di aggiungere/modificare/rimuovere singole voci
- [ ] Sezione ruoli: tutti i ruoli visualizzati, valori nulli indicati chiaramente
- [ ] Pulsante "Salva modifiche" invia PUT all'API e mostra conferma
- [ ] Pulsante "Esporta JSON" scarica il file aggiornato
- [ ] Breadcrumb per tornare allo storico

---

## Note tecniche (EP-003)
- Stack: React 18, TypeScript, Vite
- HTTP client: axios con base URL configurabile via env
- Stato: React state locale (no Redux — complessità non giustificata)
- Stile: Tailwind CSS
- Routing: React Router v6

## Impatto su epiche esistenti
Dipende da EP-002 (consuma le API). Nessuna modifica a EP-001 o EP-002.

---

# EP-004: Containerizzazione e deploy locale

## User Persona
Come Mauro Ferri (Lookin — responsabile tecnico del delivery), voglio che l'intero sistema sia containerizzato con Docker Compose e avviabile con un singolo comando, perché devo poter consegnare al cliente un sistema riproducibile su qualsiasi macchina e predisposto per il deploy su GCP.

## Contesto
Il sistema è composto da tre componenti (backend FastAPI, frontend React, database PostgreSQL). Per garantire riproducibilità e semplicità di deploy, tutto deve girare in container Docker orchestrati da Docker Compose. Le credenziali AWS vengono montate dal filesystem locale; quelle GCS tramite variabile d'ambiente.

## Obiettivo
`docker compose up --build` avvia l'intero sistema funzionante, con backend su porta 8000, frontend su porta 3000 e database su porta 5432.

## Non-obiettivi
- Non configurare il deploy su GCP Cloud Run in questa epica (passo successivo)
- Non implementare CI/CD
- Non ottimizzare le immagini Docker per produzione (multi-stage build è benvenuto ma non obbligatorio)

## Criteri di accettazione
- [ ] `docker compose up --build` si completa senza errori
- [ ] Frontend raggiungibile su `http://localhost:3000`
- [ ] Backend raggiungibile su `http://localhost:8000/docs`
- [ ] Upload di `Det 08 Affidamento servizi cartellonistica.pdf` produce JSON corrispondente al file di riferimento `output/determine.json`
- [ ] Le credenziali AWS vengono lette da `~/.aws` montato come volume read-only
- [ ] Il file `.env.example` documenta tutte le variabili d'ambiente necessarie

## Storie

### ST-004.01: Dockerfile backend e frontend

**Come** sistema di deploy,
**voglio** immagini Docker per backend e frontend,
**perché** è il prerequisito per orchestrare i container con Docker Compose.

**Criteri di accettazione:**
- [ ] `backend/Dockerfile`: Python 3.12-slim, installa `poppler-utils`, dipendenze da `requirements.txt`
- [ ] `frontend/Dockerfile`: Node 20-alpine, build Vite, serve con `nginx`
- [ ] Entrambe le immagini si buildano senza errori

---

### ST-004.02: Docker Compose orchestration

**Come** operatore di deploy,
**voglio** avviare tutto il sistema con un singolo comando,
**perché** riduce la complessità operativa e garantisce che i componenti si avviino nell'ordine corretto.

**Criteri di accettazione:**
- [ ] `docker-compose.yml` definisce i tre servizi: `db`, `backend`, `frontend`
- [ ] `backend` attende che `db` sia healthy prima di avviarsi
- [ ] Volume `~/.aws` montato in `backend` come read-only
- [ ] `db` usa volume persistente per i dati

---

### ST-004.03: Migrazioni database e .env

**Come** sistema di deploy,
**voglio** che lo schema del database venga creato automaticamente all'avvio,
**perché** non si può richiedere un passo manuale di setup del DB ad ogni deploy.

**Criteri di accettazione:**
- [ ] Le migrazioni Alembic vengono eseguite all'avvio del backend
- [ ] `.env.example` documenta: `AWS_REGION`, `AWS_PROFILE`, `BEDROCK_MODEL_ID`, `DATABASE_URL`, `GCS_PROJECT_ID`
- [ ] Il sistema funziona correttamente senza `GCS_PROJECT_ID` se non si usa la funzionalità bulk GCS

---

## Note tecniche (EP-004)
- `backend/Dockerfile`: CMD con `alembic upgrade head && uvicorn app.main:app ...`
- `frontend/Dockerfile`: multi-stage — stage 1 build Vite, stage 2 nginx serve `/dist`
- Nginx config: proxy `/api/*` verso `http://backend:8000` per evitare CORS in produzione

## Impatto su epiche esistenti
Contiene e orchestra EP-001, EP-002, EP-003. Nessuna modifica funzionale.
