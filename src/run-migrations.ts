import { AppDataSource } from './data-source';

AppDataSource.initialize()
  .then(async (ds) => {
    console.log('Running migrations...');
    const migrations = await ds.runMigrations();
    if (migrations.length === 0) {
      console.log('No pending migrations.');
    } else {
      migrations.forEach((m) => console.log(`✅ Ran migration: ${m.name}`));
    }
    await ds.destroy();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
