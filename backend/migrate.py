import sqlite3
conn = sqlite3.connect('var/app-instance/hospital.db')
cursor = conn.cursor()
try:
    cursor.execute('ALTER TABLE users ADD COLUMN is_blacklisted BOOLEAN DEFAULT 0')
    print('Added is_blacklisted')
except Exception as e:
    print('is_blacklisted already exists:', e)
try:
    cursor.execute('ALTER TABLE users ADD COLUMN blacklist_reason TEXT DEFAULT ""')
    print('Added blacklist_reason')
except Exception as e:
    print('blacklist_reason already exists:', e)
conn.commit()
conn.close()
print('Migration done')