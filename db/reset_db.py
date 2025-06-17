import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from .database import engine, Base
from .models import County, DailyPM25, Population, Demographics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('db_reset.log')
    ]
)
logger = logging.getLogger(__name__)

def drop_tables():
    """Drop all database tables."""
    try:
        logger.info("Dropping all database tables...")
        Base.metadata.drop_all(bind=engine)
        logger.info("All tables dropped successfully.")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error dropping tables: {e}")
        return False

def create_tables():
    """Create all database tables."""
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("All tables created successfully.")
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error creating tables: {e}")
        return False

def reset_database():
    """Reset the database by dropping and recreating all tables."""
    logger.info("Starting database reset...")
    
    if not drop_tables():
        logger.error("Failed to drop tables. Aborting reset.")
        return False
        
    if not create_tables():
        logger.error("Failed to create tables. Database may be in an inconsistent state.")
        return False
    
    logger.info("Database reset completed successfully.")
    return True

if __name__ == "__main__":
    import sys
    
    if not reset_database():
        sys.exit(1)
    sys.exit(0)
