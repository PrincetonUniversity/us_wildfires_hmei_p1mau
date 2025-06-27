from datetime import date
from sqlalchemy import Column, Integer, Float, String, Boolean, Date, ForeignKey, UniqueConstraint, extract, func, Index
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
    yearly_summaries = relationship("YearlyPM25Summary", back_populates="county")
    monthly_summaries = relationship("MonthlyPM25Summary", back_populates="county")
    seasonal_summaries = relationship("SeasonalPM25Summary", back_populates="county")
    baseline_mortality_rates = relationship("BaselineMortalityRate", back_populates="county")

class DailyPM25(Base):
    __tablename__ = "daily_pm25"
    
    id = Column(Integer, primary_key=True, index=True)
    fips = Column(String, ForeignKey("counties.fips"), index=True, nullable=False)
    county_index = Column(Integer, index=True, nullable=False)  # For easier county matching
    date = Column(Date, index=True, nullable=False)
    total = Column(Float, nullable=False)  # Total PM2.5
    fire = Column(Float, nullable=False)    # Fire-related PM2.5
    nonfire = Column(Float, nullable=False)  # Non-fire PM2.5
    
    __table_args__ = (UniqueConstraint("fips", "date", name="_fips_date_uc"),)

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
    age_group = Column(Integer)
    population = Column(Integer)

    county = relationship("County", back_populates="populations")

    __table_args__ = (UniqueConstraint("fips", "year", "age_group", name="_fips_year_age_uc"),)

class YearlyPM25Summary(Base):
    __tablename__ = "yearly_pm25_summary"
    
    fips = Column(String, ForeignKey("counties.fips"), primary_key=True)
    year = Column(Integer, primary_key=True)
    
    # Aggregated values
    avg_total = Column(Float, nullable=False)
    avg_fire = Column(Float, nullable=False) 
    avg_nonfire = Column(Float, nullable=False)
    
    max_total = Column(Float, nullable=False)
    max_fire = Column(Float, nullable=False)
    max_nonfire = Column(Float, nullable=False)
    
    # Metadata
    days_count = Column(Integer, nullable=False)  # for data quality checks
    
    pop_weighted_total = Column(Float, nullable=True)
    pop_weighted_fire = Column(Float, nullable=True)
    pop_weighted_nonfire = Column(Float, nullable=True)
    
    county = relationship("County", back_populates="yearly_summaries")

class MonthlyPM25Summary(Base):
    __tablename__ = "monthly_pm25_summary"
    
    fips = Column(String, ForeignKey("counties.fips"), primary_key=True)
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    
    avg_total = Column(Float, nullable=False)
    avg_fire = Column(Float, nullable=False)
    avg_nonfire = Column(Float, nullable=False)
    
    max_total = Column(Float, nullable=False)
    max_fire = Column(Float, nullable=False)
    max_nonfire = Column(Float, nullable=False)

    days_count = Column(Integer, nullable=False)
    
    pop_weighted_total = Column(Float, nullable=True)
    pop_weighted_fire = Column(Float, nullable=True)
    pop_weighted_nonfire = Column(Float, nullable=True)
    
    county = relationship("County", back_populates="monthly_summaries")

class SeasonalPM25Summary(Base):
    __tablename__ = "seasonal_pm25_summary"
    
    fips = Column(String, ForeignKey("counties.fips"), primary_key=True)
    year = Column(Integer, primary_key=True)
    season = Column(String, primary_key=True)  # 'spring', 'summer', 'fall', 'winter'
    
    avg_total = Column(Float, nullable=False)
    avg_fire = Column(Float, nullable=False)
    avg_nonfire = Column(Float, nullable=False)
    
    max_total = Column(Float, nullable=False)
    max_fire = Column(Float, nullable=False)
    max_nonfire = Column(Float, nullable=False)

    days_count = Column(Integer, nullable=False)
    
    pop_weighted_total = Column(Float, nullable=True)
    pop_weighted_fire = Column(Float, nullable=True)
    pop_weighted_nonfire = Column(Float, nullable=True)
    
    county = relationship("County", back_populates="seasonal_summaries")

class ExcessMortalitySummary(Base):
    __tablename__ = "excess_mortality_summary"

    id = Column(Integer, primary_key=True)
    fips = Column(String, ForeignKey("counties.fips"))

    year = Column(Integer)
    total_excess = Column(Float)
    fire_excess = Column(Float)
    nonfire_excess = Column(Float)
    population = Column(Integer)

    __table_args__ = (UniqueConstraint("fips", "year", name="_fips_year_uc"),)

class BaselineMortalityRate(Base):
    __tablename__ = "baseline_mortality_rate"

    id = Column(Integer, primary_key=True)
    fips = Column(String, ForeignKey("counties.fips"), index=True)
    county_index = Column(Integer, index=True)

    year = Column(Integer, index=True)
    age_group = Column(Integer)
    stat_type = Column(String)  # 'mean', 'upper', 'lower'
    value = Column(Float)
    source = Column(String)
    allage_flag = Column(Boolean)

    county = relationship("County", back_populates="baseline_mortality_rates")

    __table_args__ = (
        UniqueConstraint("fips", "year", "age_group", "stat_type", "source", name="_unique_mortality_entry"),
    )
    

# Add indexes for fast queries
# Run after creating tables:
"""
CREATE INDEX idx_yearly_summary_year ON yearly_pm25_summary(year);
CREATE INDEX idx_monthly_summary_year_month ON monthly_pm25_summary(year, month);
CREATE INDEX idx_seasonal_summary_year_season ON seasonal_pm25_summary(year, season);
"""
