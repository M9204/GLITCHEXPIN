const express = require('express');
const path = require('path');
const { uploadJSON, getJSON } = require('./googleDrive');
const app = express();

const FOLDER_ID = "19ogsV3AT99gzwNfUiDDvYsMudrQ31CdZ"; // set in advance
const FILE_NAME = "data.json";
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Retrieve data
app.get('/api/data', async (req, res) => {
  try {
    const data = await getJSON(FILE_NAME, FOLDER_ID);
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching from Drive");
  }
});

// Save new data
app.post('/api/data', async (req, res) => {
  try {
    let data = await getJSON(FILE_NAME, FOLDER_ID);
    data = data || [];
    const newData = req.body;
    newData.id = newData.id || Date.now().toString();
    data.push(newData);

    await uploadJSON(FILE_NAME, data, FOLDER_ID);
    res.status(200).send("Data saved successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error writing to Drive");
  }
});

// Update status
app.put('/api/updateStatus/:id', async (req, res) => {
  try {
    let data = await getJSON(FILE_NAME, FOLDER_ID);
    if (!data) return res.status(404).send("No data found");

    const entryId = req.params.id;
    const entryIndex = data.findIndex(e => e.id === entryId);
    if (entryIndex === -1) return res.status(404).send("Entry not found");

    data[entryIndex].status = req.body.status;

    await uploadJSON(FILE_NAME, data, FOLDER_ID);
    res.status(200).send("Status updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating Drive data");
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
