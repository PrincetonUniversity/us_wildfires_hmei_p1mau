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
    yearly_summaries = relationship("YearlyPM25Summary", back_populates="county")
    monthly_summaries = relationship("MonthlyPM25Summary", back_populates="county")
    seasonal_summaries = relationship("SeasonalPM25Summary", back_populates="county")

class DailyPM25(Base):
    __tablename__ = "daily_pm25"
    
    id = Column(Integer, primary_key=True, index=True)
    fips = Column(String, ForeignKey("counties.fips"), index=True, nullable=False)
    county_index = Column(Integer, index=True, nullable=False)  # For easier county matching
    date = Column(Date, index=True, nullable=False)
    total = Column(Float, nullable=False)  # Total PM2.5
    fire = Column(Float, nullable=False)    # Fire-related PM2.5
    nonfire = Column(Float, nullable=False)  # Non-fire PM2.5
    
    # Fixed: Only one __table_args__ definition
    __table_args__ = (
        UniqueConstraint("fips", "date", name="_fips_date_uc"),
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

class YearlyPM25Summary(Base):
    __tablename__ = "yearly_pm25_summary"
    
    fips = Column(String, ForeignKey("counties.fips"), primary_key=True)  # Fixed: Added ForeignKey
    year = Column(Integer, primary_key=True)
    
    # Aggregated values
    avg_total = Column(Float, nullable=False)
    avg_fire = Column(Float, nullable=False) 
    avg_nonfire = Column(Float, nullable=False)
    
    max_total = Column(Float, nullable=False)
    max_fire = Column(Float, nullable=False)
    
    # Metadata
    days_count = Column(Integer, nullable=False)  # for data quality checks
    
    county = relationship("County", back_populates="yearly_summaries")  # Fixed: Added back_populates

class MonthlyPM25Summary(Base):
    __tablename__ = "monthly_pm25_summary"
    
    fips = Column(String, ForeignKey("counties.fips"), primary_key=True)  # Fixed: Added ForeignKey
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    
    avg_total = Column(Float, nullable=False)
    avg_fire = Column(Float, nullable=False)
    avg_nonfire = Column(Float, nullable=False)
    
    max_total = Column(Float, nullable=False)
    max_fire = Column(Float, nullable=False)
    
    days_count = Column(Integer, nullable=False)
    
    county = relationship("County", back_populates="monthly_summaries")  # Fixed: Added back_populates

class SeasonalPM25Summary(Base):
    __tablename__ = "seasonal_pm25_summary"
    
    fips = Column(String, ForeignKey("counties.fips"), primary_key=True)  # Fixed: Added ForeignKey
    year = Column(Integer, primary_key=True)
    season = Column(String, primary_key=True)  # 'spring', 'summer', 'fall', 'winter'
    
    avg_total = Column(Float, nullable=False)
    avg_fire = Column(Float, nullable=False)
    avg_nonfire = Column(Float, nullable=False)
    
    max_total = Column(Float, nullable=False)
    max_fire = Column(Float, nullable=False)
    
    days_count = Column(Integer, nullable=False)
    
    county = relationship("County", back_populates="seasonal_summaries")  # Fixed: Added back_populates

# Add indexes for fast queries
# Run after creating tables:
"""
CREATE INDEX idx_yearly_summary_year ON yearly_pm25_summary(year);
CREATE INDEX idx_monthly_summary_year_month ON monthly_pm25_summary(year, month);
CREATE INDEX idx_seasonal_summary_year_season ON seasonal_pm25_summary(year, season);
"""
