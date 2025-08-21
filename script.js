/*******************************
 Google Drive JSON Save/Load
*******************************/

const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com"; // put your OAuth client ID here
const API_KEY = "AIzaSyCDg9_fXdnhP31DGwceBdQkWtTIrtTR_OQ"; // put your API key here
const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // your folder
const FILE_NAME = "finance-data.json"; // single JSON file name

const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata";

let tokenClient;
let gapiInited = false;
let gisInited = false;
let fileId = null; // will store ID of the finance-data.json file

/*******************************
 Load GAPI
*******************************/
function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  gapiInited = true;
  maybeEnableButtons();
}

/*******************************
 Init Google Identity
*******************************/
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: "", 
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById("authorize_button").style.display = "block";
  }
}

function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw resp;
    }
    document.getElementById("signout_button").style.display = "block";
    await ensureSingleFile();
    await loadData();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    document.getElementById("signout_button").style.display = "none";
  }
}

/*******************************
 Ensure Only One File
*******************************/
async function ensureSingleFile() {
  const res = await gapi.client.drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${FILE_NAME}' and trashed=false`,
    fields: "files(id, name)",
  });

  if (res.result.files && res.result.files.length > 0) {
    fileId = res.result.files[0].id;
  } else {
    // create new file
    const metadata = {
      name: FILE_NAME,
      mimeType: "application/json",
      parents: [FOLDER_ID],
    };
    const fileContent = JSON.stringify([]);
    const boundary = "-------314159265358979323846";
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const body =
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      fileContent +
      closeDelim;

    const createRes = await gapi.client.request({
      path: "/upload/drive/v3/files?uploadType=multipart",
      method: "POST",
      params: { uploadType: "multipart" },
      headers: {
        "Content-Type": 'multipart/related; boundary="' + boundary + '"',
      },
      body: body,
    });

    fileId = createRes.result.id;
  }
}

/*******************************
 Save Data
*******************************/
async function saveData(data) {
  if (!fileId) await ensureSingleFile();

  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  const metadata = {
    name: FILE_NAME,
    mimeType: "application/json",
  };

  const body =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(data) +
    closeDelim;

  await gapi.client.request({
    path: "/upload/drive/v3/files/" + fileId,
    method: "PATCH",
    params: { uploadType: "multipart" },
    headers: {
      "Content-Type": 'multipart/related; boundary="' + boundary + '"',
    },
    body: body,
  });
}

/*******************************
 Load Data
*******************************/
async function loadData() {
  if (!fileId) await ensureSingleFile();
  const res = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: "media",
  });
  const data = res.result || [];
  renderTable(data);
}

/*******************************
 UI Functions (example)
*******************************/
function addEntry() {
  const title = document.getElementById("title").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const source = document.getElementById("source").value;
  const notes = document.getElementById("notes").value;
  const date = document.getElementById("date").value;

  const entry = {
    id: Date.now(),
    type: "income",
    title,
    amount,
    source,
    notes,
    date,
    status: "",
  };

  loadData().then((data) => {
    data.push(entry);
    saveData(data);
    renderTable(data);
  });
}

async function deleteEntry(id) {
  const res = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: "media",
  });
  let data = res.result || [];
  data = data.filter((e) => e.id !== id);
  await saveData(data);
  renderTable(data);
}

function renderTable(data) {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  data.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.title}</td>
      <td>${row.amount}</td>
      <td>${row.source}</td>
      <td>${row.notes}</td>
      <td>${row.date}</td>
      <td><button onclick="deleteEntry(${row.id})">Delete</button></td>
    `;
    table.appendChild(tr);
  });
}
