from datetime import date
from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey, UniqueConstraint, extract, func, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, column_property
from sqlalchemy.ext.hybrid import hybrid_property
from .database import Base

class County(Base):
    __tablename__ = "counties"

    fips = Column(String, primary_key=True, index=True)
    name = Column(String)
    index = Column(Integer, unique=True)
    geometry = Column(JSONB)  # Store GeoJSON as JSONB

    pm25_data = relationship("DailyPM25", back_populates="county")
    populations = relationship("Population", back_populates="county")
    demographics = relationship("Demographics", back_populates="county")

class DailyPM25(Base):
    __tablename__ = "daily_pm25"
    
    id = Column(Integer, primary_key=True, index=True)
    fips = Column(String, ForeignKey("counties.fips"), index=True, nullable=False)
    county_index = Column(Integer, index=True, nullable=False)  # For easier county matching
    date = Column(Date, index=True, nullable=False)
    total = Column(Float, nullable=False)  # Total PM2.5
    fire = Column(Float, nullable=False)    # Fire-related PM2.5
    nonfire = Column(Float, nullable=False)  # Non-fire PM2.5
    
    __table_args__ = (
        # Existing unique constraint
        {'postgresql_using': 'btree'},  # Use btree index by default
    )

    county = relationship("County", back_populates="pm25_data")

    # Hybrid properties for backward compatibility
    @hybrid_property
    def year(self):
        return self.date.year if self.date else None

    @year.expression
    def year(cls):
        return extract('year', cls.date)
        
    # Alias properties for backward compatibility
    @property
    def pm25_value(self):
        return self.total
        
    @property
    def fire_pm25(self):
        return self.fire
        
    @property
    def non_fire_pm25(self):
        return self.nonfire

    @hybrid_property
    def month(self):
        return self.date.month if self.date else None

    @month.expression
    def month(cls):
        return extract('month', cls.date)

    @hybrid_property
    def day(self):
        return self.date.day if self.date else None

    @day.expression
    def day(cls):
        return extract('day', cls.date)

    __table_args__ = (UniqueConstraint("fips", "date", name="_fips_date_uc"),)

class Population(Base):
    __tablename__ = "population"

    id = Column(Integer, primary_key=True)
    fips = Column(String, ForeignKey("counties.fips"))
    year = Column(Integer, index=True)
    population = Column(Integer)

    county = relationship("County", back_populates="populations")

    __table_args__ = (UniqueConstraint("fips", "year", name="_fips_year_uc"),)

class Demographics(Base):
    __tablename__ = "demographics"

    id = Column(Integer, primary_key=True)
    fips = Column(String, ForeignKey("counties.fips"))
    metric = Column(String)
    value = Column(Float)

    county = relationship("County", back_populates="demographics")

    __table_args__ = (UniqueConstraint("fips", "metric", name="_fips_metric_uc"),)
