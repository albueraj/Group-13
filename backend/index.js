const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Serve logo images

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'crud_db',
});

// File upload configuration
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Get company settings
app.get('/api/settings', (req, res) => {
  db.query('SELECT * FROM company_settings WHERE id = 1', (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(result[0]);
  });
});

// Helper function to delete old logo
const deleteOldLogo = (logoUrl) => {
  if (!logoUrl) return;

  const logoPath = path.join(__dirname, logoUrl);
  fs.unlink(logoPath, (err) => {
    if (err) {
      console.error(`Error deleting old logo at ${logoPath}: ${err}`);
    } else {
      console.log(`Previous logo at ${logoPath} deleted successfully.`);
    }
  });
};

// Register route
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  db.query(query, [username, email, hashedPassword], (err, result) => {
    if (err) return res.status(500).send(err);
    res.status(200).send({ message: 'User Registered' });
  });
});

// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], async (err, result) => {
    if (err) return res.status(500).send(err);
    if (result.length === 0) return res.status(400).send({ message: 'User not found' });

    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.status(400).send({ message: 'Invalid Credentials' });

    const token = jwt.sign({ id: user.id }, 'secret', { expiresIn: '1h' });
    res.status(200).send({ token, user: { username: user.username, email: user.email } });
  });
});

// Get all college records
app.get('/dashboard', (req, res) => {
  db.query('SELECT * FROM college_info', (err, result) => {
    if (err) return res.status(500).send('Server error');
    res.json(result);
  });
});

// Add a new college record
app.post('/dashboard', (req, res) => {
  const {
    collegeNameOfSchool,
    collegeDegree,
    collegePeriodFrom,
    collegePeriodTo,
    collegeHighestAttained,
    collegeYearGraduated,
    collegeScholarshipAcademicHonorsReceived,
    person_id,
  } = req.body;

  const query = `
    INSERT INTO college_info 
    (collegeNameOfSchool, collegeDegree, collegePeriodFrom, collegePeriodTo, collegeHighestAttained, collegeYearGraduated, collegeScholarshipAcademicHonorsReceived, person_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    collegeNameOfSchool,
    collegeDegree,
    collegePeriodFrom,
    collegePeriodTo,
    collegeHighestAttained,
    collegeYearGraduated,
    collegeScholarshipAcademicHonorsReceived,
    person_id,
  ], (err, result) => {
    if (err) return res.status(500).send('Server error');
    res.json(result);
  });
});

// Update a college record
app.put('/dashboard/:id', (req, res) => {
  const { id } = req.params;
  const {
    collegeNameOfSchool,
    collegeDegree,
    collegePeriodFrom,
    collegePeriodTo,
    collegeHighestAttained,
    collegeYearGraduated,
    collegeScholarshipAcademicHonorsReceived,
    person_id,
  } = req.body;

  const query = `
    UPDATE college_info 
    SET collegeNameOfSchool = ?, collegeDegree = ?, collegePeriodFrom = ?, collegePeriodTo = ?, 
        collegeHighestAttained = ?, collegeYearGraduated = ?, collegeScholarshipAcademicHonorsReceived = ?, person_id = ?
    WHERE id = ?
  `;

  db.query(query, [
    collegeNameOfSchool,
    collegeDegree,
    collegePeriodFrom,
    collegePeriodTo,
    collegeHighestAttained,
    collegeYearGraduated,
    collegeScholarshipAcademicHonorsReceived,
    person_id,
    id,
  ], (err, result) => {
    if (err) return res.status(500).send('Server error');
    res.json(result);
  });
});

// Delete a college record
app.delete('/dashboard/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM college_info WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send('Server error');
    res.sendStatus(204); // No content
  });
});

// Update company settings
app.post('/api/settings', upload.single('logo'), (req, res) => {
  const companyName = req.body.company_name || '';
  const headerColor = req.body.header_color || '#ffffff';
  const footerText = req.body.footer_text || '';
  const footerColor = req.body.footer_color || '#ffffff';
  const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  db.query('SELECT * FROM company_settings WHERE id = 1', (err, result) => {
    if (err) throw err;

    if (result.length > 0) {
      const oldLogoUrl = result[0].logo_url;

      const query = `UPDATE company_settings 
                     SET company_name = ?, header_color = ?, footer_text = ?, footer_color = ?` +
                    (logoUrl ? ', logo_url = ?' : '') + ' WHERE id = 1';
      const params = [companyName, headerColor, footerText, footerColor];
      if (logoUrl) params.push(logoUrl);

      db.query(query, params, (err) => {
        if (err) throw err;

        if (logoUrl && oldLogoUrl) {
          deleteOldLogo(oldLogoUrl);
        }

        res.send({ success: true });
      });
    } else {
      const query = 'INSERT INTO company_settings (company_name, header_color, footer_text, footer_color, logo_url) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [companyName, headerColor, footerText, footerColor, logoUrl], (err) => {
        if (err) throw err;
        res.send({ success: true });
      });
    }
  });
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});
