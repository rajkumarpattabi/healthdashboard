// HealthDashboard configuration.
// The app works fully on-device without this. The Client ID enables Google Drive backup.
// A client-side OAuth Client ID is NOT a secret — it's protected by the "authorised
// JavaScript origins" you set on it in Google Cloud Console.
window.HD_CONFIG = {
  GOOGLE_CLIENT_ID: "903091492554-39i0rrd5800pqkfk6r7q5n0hcb42rg3q.apps.googleusercontent.com",
  GOOGLE_API_KEY:   "",   // not needed (the app creates its own Drive folder; no Picker)
  DRIVE_FOLDER_ID:  ""    // not used — the app auto-creates a "HealthDashboard" folder
};
