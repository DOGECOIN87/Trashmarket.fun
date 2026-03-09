const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Firebase project ID
const projectId = 'trashmarket-fun';

// We need to use the Firebase CLI's auth token for credentials
// The firebase-admin SDK will use Application Default Credentials
// Let's explicitly set the project

initializeApp({
  projectId: projectId
});

const db = getFirestore();

// Admin wallet addresses provided by user
const adminWallets = [
  'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo',
  'GdS8GCrAaVviZE5nxTNGG3pYxxb1UCgUbf23FwCTVirK'
];

async function setupAdminConfig() {
  try {
    // Create the admin config document
    await db.collection('config').doc('admins').set({
      wallets: adminWallets,
      createdAt: new Date().toISOString(),
      createdBy: 'setup-script'
    });

    console.log('✅ Admin config created successfully!');
    console.log('Admin wallets:', adminWallets);

    // Verify the document was created
    const doc = await db.collection('config').doc('admins').get();
    console.log('Document data:', doc.data());

  } catch (error) {
    console.error('Error setting up admin config:', error);
    process.exit(1);
  }
}

setupAdminConfig();
