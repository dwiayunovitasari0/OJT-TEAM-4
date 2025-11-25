CREATE DATABASE geo_mandiri_kreasi;
USE geo_mandiri_kreasi;

-- Table untuk user login (kalau belum ada)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table untuk pengajuan sertifikat/test
CREATE TABLE test_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_type VARCHAR(255),
  company_name VARCHAR(255),
  details TEXT,
  dokumen_path VARCHAR(255),
  certificate_path VARCHAR(255),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
ALTER TABLE users ADD COLUMN role ENUM('user','ahli','admin') DEFAULT 'user';

INSERT INTO users (name, email, password, role)
VALUES (
  'Ahli Penguji',
  'ahli@geo.com',
  '$2a$08$wXXlGGRGOBbPWj3Rq/3pmumRuZnQtWvvTE2sTIYX8yiPRuIgvQGoO',  -- password: 123456
  'ahli'
);


UPDATE users 
SET password = '$2a$08$wXXlGGRGOBbPWj3Rq/3pmumRuZnQtWvvTE2sTIYX8yiPRuIgvQGoO' 
WHERE email = 'ahli@geo.com';


DELETE FROM test_submissions WHERE id = 21;

ALTER TABLE test_submissions 
DROP COLUMN certificate_path;
DESCRIBE test_submissions;



ALTER TABLE test_submissions 
MODIFY COLUMN status ENUM(
  'pending',
  'approved_admin',
  'rejected',
  'menunggu_jadwal',
  'terjadwal',
  'selesai_layak',
  'selesai_tidak_layak'
) NOT NULL DEFAULT 'pending';
