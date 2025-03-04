const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path to store the data file
const dataFilePath = path.join(__dirname, 'data.json');

// Endpoint to retrieve data from the JSON file
app.get('/api/data', (req, res) => {
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading data');
    }
    // Send parsed data as JSON
    res.json(JSON.parse(data));
  });
});

// Endpoint to save new data to the JSON file
app.post('/api/data', (req, res) => {
  const newData = req.body;

  // Read current data
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    let dataArr = [];
    if (err && err.code === 'ENOENT') {
      // If file doesn't exist, create an empty array
      dataArr = [];
    } else if (err) {
      return res.status(500).send('Error reading data');
    } else {
      // Parse current data
      dataArr = JSON.parse(data);
    }

    // Assign a unique id for the new data (you could generate this in other ways)
    newData.id = newData.id || Date.now().toString();

    // Add new data to the array
    dataArr.push(newData);

    // Write updated data back to file
    fs.writeFile(dataFilePath, JSON.stringify(dataArr, null, 2), 'utf8', (err) => {
      if (err) {
        return res.status(500).send('Error writing data');
      }
      // Respond with success
      res.status(200).send('Data saved successfully');
    });
  });
});

// Endpoint to update the status of an entry by ID
app.put('/api/updateStatus/:id', (req, res) => {
  const updatedStatus = req.body.status;
  const entryId = req.params.id;
  
  // Read current data from the JSON file
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading data');
    }

    let dataArr = JSON.parse(data);
    const entryIndex = dataArr.findIndex(entry => entry.id === entryId);
    
    if (entryIndex === -1) {
      return res.status(404).send('Entry not found');
    }

    // Update the status of the entry
    dataArr[entryIndex].status = updatedStatus;

    // Write the updated data back to the file
    fs.writeFile(dataFilePath, JSON.stringify(dataArr, null, 2), 'utf8', (err) => {
      if (err) {
        return res.status(500).send('Error writing data');
      }
      res.status(200).send('Status updated successfully');
    });
  });
});


// Serve the index.html page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
