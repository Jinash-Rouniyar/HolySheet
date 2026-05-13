#!/bin/bash

# Test script for all 9 spreadsheet operations
# Make sure the server is running on port 5000

BASE_URL="http://localhost:5000/api/sheet/operation"

echo "Testing all 9 spreadsheet operations..."
echo ""

# 1. get_sheets
echo "1. Testing get_sheets..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"type": "get_sheets"}'
echo -e "\n"

# 2. get_range_data
echo "2. Testing get_range_data..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{"type": "get_range_data", "sheet_id": "Sheet1", "range": "A1:B10"}'
echo -e "\n"

# 3. set_range_data
echo "3. Testing set_range_data..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "set_range_data",
    "sheet_id": "Sheet1",
    "range": "A1:B3",
    "data": {
      "A1": "Test Header 1",
      "A2": "Value 1",
      "B1": "Test Header 2",
      "B2": "Value 2"
    }
  }'
echo -e "\n"

# 4. set_range_style
echo "4. Testing set_range_style..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "set_range_style",
    "sheet_id": "Sheet1",
    "range": "A1:B1",
    "style": {
      "bold": true,
      "fontSize": 14,
      "fontColor": "#000000"
    }
  }'
echo -e "\n"

# 5. rename_sheet
echo "5. Testing rename_sheet..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rename_sheet",
    "sheet_id": "Sheet1",
    "new_name": "Test Sheet"
  }'
echo -e "\n"

# 6. create_sheet
echo "6. Testing create_sheet..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "create_sheet",
    "sheet_name": "New Test Sheet"
  }'
echo -e "\n"

# 7. insert_rows
echo "7. Testing insert_rows..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "insert_rows",
    "sheet_id": "Sheet1",
    "start_row": 5,
    "count": 3
  }'
echo -e "\n"

# 8. insert_columns
echo "8. Testing insert_columns..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "insert_columns",
    "sheet_id": "Sheet1",
    "start_col": 2,
    "count": 2
  }'
echo -e "\n"

# 9. set_cell_dimensions
echo "9. Testing set_cell_dimensions..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "set_cell_dimensions",
    "sheet_id": "Sheet1",
    "dimensions": {
      "columns": [{"index": 0, "width": 150}],
      "rows": [{"index": 0, "height": 30}]
    }
  }'
echo -e "\n"

echo "All operations queued! Check the browser to see if they executed."
echo ""
echo "To check pending operations:"
echo "curl http://localhost:5000/api/sheet/operations/pending"

