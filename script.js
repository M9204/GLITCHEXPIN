console.log("script.js loaded");

let totalIncome = 0, totalExpenses = 0;
let entries = []; // Make sure entries is always an array
let accessToken = null, fileId = null;
const FILE_NAME = "tracker_data.json";
const CLIENT_ID = "4870239215-m0sg6fkgnl7dd925l22efedcq9lfds8h.apps.googleusercontent.com"; // replace
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// ----------- Google Drive Auth -----------
function initGoogleAPI() {
  gapi.load("client", async () => {
    await gapi.client.init({
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", () => {
  google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      accessToken = resp.access_token;
      document.getElementById("loginBtn").classList.add("hidden");
      document.getElementById("logoutBtn").classList.remove("hidden");
      document.getElementById("userInfo").innerText = "Signed in!";
      loadData();
    }
  }).requestAccessToken();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  accessToken = null;
  entries = [];
  document.getElementById("entriesTableBody").innerHTML = "";
  totalIncome = 0; totalExpenses = 0;
  document.getElementById("totalIncome").textContent = "$0.00";
  document.getElementById("totalExpenses").textContent = "$0.00";
  document.getElementById("netTotal").textContent = "$0.00";
  document.getElementById("loginBtn").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("userInfo").innerText = "";
});

// ----------- Drive helpers -----------
async function getFileId() {
  let res = await gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: "files(id, name)"
  });
  if (res.result.files.length > 0) return res.result.files[0].id;

  // Create file if not exists
  let createRes = await gapi.client.request({
    path: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: JSON.stringify({ name: FILE_NAME, mimeType: "application/json" })
  });
  return createRes.result.id;
}

async function saveToDrive() {
  if (!accessToken) return;
  if (!fileId) fileId = await getFileId();
  await gapi.client.request({
    path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
    body: JSON.stringify(entries)
  });
  alert("Data synced with Google Drive!");
}

// ----------- Load data from Drive -----------
async function loadData() {
  if (!accessToken) return;
  try {
    fileId = await getFileId();
    let res = await gapi.client.request({
      path: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      method: "GET",
      headers: { Authorization: "Bearer " + accessToken }
    });

    entries = res.body ? JSON.parse(res.body) : [];
    if (!Array.isArray(entries)) entries = []; // ensure array

    // Populate table & recalc totals
    totalIncome = 0; totalExpenses = 0;
    document.getElementById("entriesTableBody").innerHTML = "";
    entries.forEach(entry => addRowToTable(
      entry.type, entry.title, entry.amount, entry.source, entry.notes, entry.date, entry.id, entry.status
    ));
  } catch (err) {
    console.error("Error loading Drive data:", err);
    entries = [];
  }
}

// ----------- App logic -----------
window.onload = () => {
  const dateInput = document.getElementById("date");
  dateInput.value = new Date().toISOString().split("T")[0];
  document.getElementById("inputDate").classList.remove("hidden");
  initGoogleAPI();
  hideInputs();
};

function setEntryType(type) {
  const title = document.getElementById("title").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const source = document.getElementById("source").value;
  const notes = document.getElementById("notes").value;
  const date = document.getElementById("date").value;

  if (!title || isNaN(amount) || amount <= 0) {
    return alert("Enter valid title & amount");
  }

  const entryData = {
    id: Date.now(),
    type, title, amount, source, notes, date, status: ""
  };

  entries.push(entryData);
  addRowToTable(type, title, amount, source, notes, date, entryData.id, entryData.status);
  saveToDrive();
  resetForm();
}

function addRowToTable(type, title, amount, source, notes, date, id, status) {
  const tableBody = document.getElementById("entriesTableBody");
  const row = document.createElement("tr");
  row.setAttribute("data-id", id);

  row.innerHTML = `
    <td><input type="checkbox"></td>
    <td>${date}</td>
    <td>${title}</td>
    <td class="${type==="income"?"green":"red"}">$${amount.toFixed(2)}</td>
    <td>${source}</td>
    <td>
      <select class="status-dropdown">
        <option value="" ${status===""?"selected":""}>-</option>
        <option value="pending" ${status==="pending"?"selected":""}>Pending</option>
        <option value="done" ${status==="done"?"selected":""}>Done</option>
      </select>
    </td>
    <td>${notes}</td>
  `;

  row.querySelector(".status-dropdown").addEventListener("change", function() {
    const newStatus = this.value;
    updateRowBackgroundColor(row, newStatus);
    const entry = entries.find(e => e.id===id); if(entry) entry.status = newStatus;
    saveToDrive();
  });

  tableBody.appendChild(row);
  updateRowBackgroundColor(row, status);

  type==="income"? totalIncome+=amount : totalExpenses+=amount;
  document.getElementById("totalIncome").textContent = `$${totalIncome.toFixed(2)}`;
  document.getElementById("totalExpenses").textContent = `$${totalExpenses.toFixed(2)}`;
  document.getElementById("netTotal").textContent = `$${(totalIncome-totalExpenses).toFixed(2)}`;
}

function updateRowBackgroundColor(row, status) {
  row.style.backgroundColor = status==="done"?"lightgreen":status==="pending"?"lightyellow":"";
}

function resetForm() {
  document.getElementById("title").value="";
  document.getElementById("amount").value="";
  document.getElementById("source").value="";
  document.getElementById("notes").value="";
  document.getElementById("date").value=new Date().toISOString().split("T")[0];
  hideInputs();
}

// ----------- Progressive Reveal -----------
function hideInputs() {
  document.getElementById("inputAmount").classList.add("hidden");
  document.getElementById("inputSource").classList.add("hidden");
  document.getElementById("inputNotes").classList.add("hidden");
}
function showInput(id){document.getElementById(id).classList.remove("hidden");}
document.getElementById("title").addEventListener("input", ()=>{if(event.target.value.trim()!=="") showInput("inputAmount");});
document.getElementById("amount").addEventListener("input", ()=>{if(event.target.value>0) showInput("inputSource");});
document.getElementById("source").addEventListener("change", ()=>{showInput("inputNotes");});

// ----------- Export XLSX -----------
function exportToExcel(){
  let tableRows = document.querySelectorAll("#entriesTableBody tr");
  let incomeData=[["Date","Title","Amount","Source","Notes"]];
  let expenseData=[["Date","Title","Amount","Source","Notes"]];
  tableRows.forEach(row=>{
    let cols=row.querySelectorAll("td");
    let date=cols[1].textContent,title=cols[2].textContent,amount=parseFloat(cols[3].textContent.replace("$","")),source=cols[4].textContent,notes=cols[6].textContent;
    cols[3].classList.contains("green")?incomeData.push([date,title,amount,source,notes]):expenseData.push([date,title,amount,source,notes]);
  });
  let totalData=[["Category","Amount"],["Total Income",totalIncome.toFixed(2)],["Total Expenses",totalExpenses.toFixed(2)],["Net Total",(totalIncome-totalExpenses).toFixed(2)]];
  let wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(incomeData),"Income");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(expenseData),"Expenses");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(totalData),"Summary");
  XLSX.writeFile(wb,"tracker_report.xlsx");
}
