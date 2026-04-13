const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ImgBB API Key (aapki di hui)
const IMGBB_API_KEY = 'd9f2c9ef4f6308aa5a2a3156f3cf63e2';

// Data storage file
const PROPERTIES_FILE = path.join(__dirname, 'properties.json');

// Ensure properties.json exists
if (!fs.existsSync(PROPERTIES_FILE)) {
    fs.writeFileSync(PROPERTIES_FILE, JSON.stringify([], null, 2));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'oispropertysecret',
    resave: false,
    saveUninitialized: true
}));

// Multer for file upload (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper: read properties
function getProperties() {
    const data = fs.readFileSync(PROPERTIES_FILE);
    return JSON.parse(data);
}

// Helper: save properties
function saveProperties(properties) {
    fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(properties, null, 2));
}

// ==================== API ROUTES ====================

// 1. Upload image to ImgBB
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image' });
        const formData = new FormData();
        formData.append('image', req.file.buffer.toString('base64'));
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
            headers: formData.getHeaders()
        });
        res.json({ success: true, url: response.data.data.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Add new property (admin only)
app.post('/api/add-property', async (req, res) => {
    if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const { state, city, propertyName, location, budget, imageUrl } = req.body;
    if (!state || !city || !propertyName || !budget || !imageUrl) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    const properties = getProperties();
    const newProperty = {
        id: Date.now(),
        state,
        city,
        propertyName,
        location: location || '',
        budget: parseInt(budget),
        imageUrl,
        createdAt: new Date().toISOString()
    };
    properties.push(newProperty);
    saveProperties(properties);
    res.json({ success: true, property: newProperty });
});

// 3. Get all properties (with filters)
app.get('/api/properties', (req, res) => {
    let properties = getProperties();
    const { state, city, minBudget, maxBudget } = req.query;
    if (state && state !== '') {
        properties = properties.filter(p => p.state.toLowerCase() === state.toLowerCase());
    }
    if (city && city !== '') {
        properties = properties.filter(p => p.city.toLowerCase() === city.toLowerCase());
    }
    if (minBudget) {
        properties = properties.filter(p => p.budget >= parseInt(minBudget));
    }
    if (maxBudget) {
        properties = properties.filter(p => p.budget <= parseInt(maxBudget));
    }
    res.json(properties);
});

// 4. Get distinct states & cities (for search dropdowns)
app.get('/api/locations', (req, res) => {
    const properties = getProperties();
    const states = [...new Set(properties.map(p => p.state))];
    const cities = [...new Set(properties.map(p => p.city))];
    res.json({ states, cities });
});

// 5. Admin login
app.post('/api/admin-login', (req, res) => {
    const { password } = req.body;
    if (password === 'atifchauhn25') {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// 6. Admin logout
app.post('/api/admin-logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 7. Check admin status
app.get('/api/admin-status', (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
});

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
