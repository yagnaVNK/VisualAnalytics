import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import json

# Load the data
data_file = 'Boonsong Lekagul waterways readings.csv'  
measures_file = 'chemical units of measure.csv'  

# Read the data files
df = pd.read_csv(data_file)
measures_df = pd.read_csv(measures_file)

# Ensure the sample date is in datetime format
df['sample date'] = pd.to_datetime(df['sample date'], errors='coerce')

# Remove rows with invalid dates
df = df.dropna(subset=['sample date'])

df['year'] = df['sample date'].dt.year
df['month'] = df['sample date'].dt.month

# Define toxic chemicals
toxic_chemicals = [
    "Arsenic", "Lead", "Mercury", "Cadmium", "Benzo(a)pyrene", "Dieldrin",
    "Endrin", "Hexachlorobenzene", "Heptachlor", "Heptachloroepoxide", 
    "PCBs", "Pentachlorobenzene", "Aldrin", "Fluoranthene"
]

# Add a 'toxicity' column to the measures DataFrame
measures_df['toxicity'] = measures_df['measure'].apply(
    lambda x: 'toxic' if x in toxic_chemicals else 'non-toxic'
)

# Function to normalize a group of values between -1 and 1
def normalize_group(group):
    # Drop missing values in 'value' column before normalization
    group = group.dropna(subset=['value'])
    
    # Initialize the MinMaxScaler
    scaler = MinMaxScaler(feature_range=(-1, 1))
    
    # Apply the scaler and add the 'normalized_value' column
    group['normalized_value'] = scaler.fit_transform(group[['value']])
    
    return group

# Remove rows with missing values in 'measure' and 'value' columns before grouping and normalizing
df_cleaned = df.dropna(subset=['measure', 'value'])

# Apply normalization based on the 'measure' column
df_cleaned = df_cleaned.groupby('measure').apply(normalize_group)

# Reset the index to avoid ambiguity during merging
df_cleaned = df_cleaned.reset_index(drop=True)

# Merge the cleaned data with the measures file
merged_df = pd.merge(df_cleaned, measures_df, on='measure', how='left')

# Function to create year-wise aggregated data
def aggregate_by_year(data):
    year_data = data.groupby('year')['value'].agg(['mean', 'count', list]).to_dict('index')
    return {year: {'average': year_data[year]['mean'], 'count': year_data[year]['count'], 'values': year_data[year]['list']} for year in year_data}

# Build the hierarchical JSON structure
data_hierarchy = {
    "name": "Dataset",
    "year_data": aggregate_by_year(merged_df),
    "children": []
}

# Group data by location
grouped_by_location = merged_df.groupby('location')

for location, location_data in grouped_by_location:
    location_node = {
        "name": location,
        "year_data": aggregate_by_year(location_data),
        "children": []
    }
    
    # Group data by toxicity within each location
    grouped_by_toxicity = location_data.groupby('toxicity')
    for toxicity, toxicity_data in grouped_by_toxicity:
        toxicity_node = {
            "name": toxicity,
            "year_data": aggregate_by_year(toxicity_data),
            "children": []
        }
        
        # Group data by measure within each toxicity group
        grouped_by_measure = toxicity_data.groupby('measure')
        for measure, measure_data in grouped_by_measure:
            measure_node = {
                "name": measure,
                "year_data": aggregate_by_year(measure_data)
            }
            toxicity_node["children"].append(measure_node)
        
        location_node["children"].append(toxicity_node)
    
    data_hierarchy["children"].append(location_node)

# Save the JSON file
with open('data.json', 'w') as f:
    json.dump(data_hierarchy, f, indent=4)

# Confirm the file is saved
print("Hierarchical data saved as 'data.json'")
