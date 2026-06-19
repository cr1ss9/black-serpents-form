# Black Serpents Form

Φόρμα για Discord link με protected admin σελίδα.

## Τοπική εκκίνηση

```powershell
cd C:\Users\TedLasso\Desktop\black-serpents-form
npm install
npm start
```

Άνοιξε:

- Φόρμα: `http://localhost:3000`
- Admin απαντήσεις: `http://localhost:3000/admin`
- Κωδικός admin: `Bserpents`

## Discord channel ειδοποιήσεις

1. Στο Discord channel: `Edit Channel` → `Integrations` → `Webhooks` → `New Webhook`.
2. Κάνε copy το webhook URL.
3. Βάλε environment variable:

```powershell
$env:DISCORD_WEBHOOK_URL="PASTE_WEBHOOK_URL_HERE"
npm start
```

Κάθε νέα αίτηση θα στέλνεται στο channel και θα αποθηκεύεται και στο `data/submissions.json`.

## Για πραγματικό link στο Discord

Για να το ανοίγουν όλοι από Discord χρειάζεται να ανέβει online, π.χ. σε Render, Railway ή VPS. Στο hosting βάλε:

- `ADMIN_PASSWORD=Bserpents`
- `DISCORD_WEBHOOK_URL=το webhook σου` προαιρετικά

Μετά βάζεις το public URL της φόρμας στο Discord κανάλι.
