const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEYFILEPATH = path.join(__dirname, 'credentials.json'); // your service account json
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Authenticate with service account
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

// Upload or update file
async function uploadJSON(fileName, jsonData, folderId) {
  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(jsonData, null, 2),
  };

  // Check if file already exists in folder
  const listRes = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  if (listRes.data.files.length > 0) {
    // Update existing file
    const fileId = listRes.data.files[0].id;
    await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/json',
        body: media.body,
      },
    });
    return { updated: true, fileId };
  } else {
    // Create new file
    const res = await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: 'application/json',
        body: media.body,
      },
      fields: 'id',
    });
    return { created: true, fileId: res.data.id };
  }
}

// Download file content
async function getJSON(fileName, folderId) {
  const listRes = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  if (listRes.data.files.length === 0) {
    return null; // no file found
  }

  const fileId = listRes.data.files[0].id;
  const res = await drive.files.get({ fileId, alt: 'media' });
  return res.data;
}

module.exports = { uploadJSON, getJSON };
