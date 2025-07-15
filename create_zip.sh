#!/bin/bash

# Script to create a ZIP archive of required files from two projects
# Author: Grok 3 (xAI)
# Date: June 16, 2025

set -e # Exit on any error

# Project paths
PROJECT1_PATH="/media/hagemedia/hager/2025/01/mg/grok3"
PROJECT2_PATH="/home/hager/Projects/my-nextjs-project-master (2)/my-nextjs-project"
OUTPUT_DIR="$HOME/ecommerce-platform-zip"
ZIP_FILE="$HOME/ecommerce-platform-files.zip"

# Temporary directories
TEMP_DIR1="$OUTPUT_DIR/project1_files"
TEMP_DIR2="$OUTPUT_DIR/project2_files"

# Lists of required files from Project 1 (Rails)
PROJECT1_FILES=(
  # Payment and Integration Logic
  "app/business/payments/integrations/paypal_integration_rest_api.rb"
  "app/business/payments/integrations/paypal_partner_rest_credentials.rb"
  "app/business/payments/merchant_registration/implementations/stripe/stripe_merchant_account_manager.rb"
  "app/business/payments/merchant_registration/implementations/paypal/paypal_merchant_account_manager.rb"
  "app/business/sales_tax/taxjar/taxjar_api.rb"
  "app/business/payments/payouts/processor/stripe/stripe_payout_processor.rb"
  "app/business/payments/payouts/processor/paypal/paypal_payout_processor.rb"
  "app/models/integration.rb"
  # Controllers
  "app/controllers/integrations/*"
  "app/controllers/stripe/setup_intents_controller.rb"
  "app/controllers/payouts/*"
  "app/controllers/sellers/base_controller.rb"
  "app/controllers/oauth/*"
  # Frontend and Design
  "app/assets/javascripts/application.js"
  "app/javascript/components/*"
  "app/views/integrations/*"
  "app/views/layouts/*"
  "app/assets/stylesheets/*"
  "app/assets/fonts/gumicons.eot"
  "app/assets/fonts/gumicons.svg"
  "app/assets/fonts/gumicons.ttf"
  "app/assets/fonts/gumicons.woff"
  "app/assets/images/*"
  "app/assets/fonts/ABCFavorit/*"
  # Documentation
  "docs/paypal.md"
  "docs/accounting.md"
  "docs/taxes.md"
  "docs/integrations.md"
  "docs/OVERVIEW.md"
  # Services and Additional Logic
  "app/services/*"
  "app/models/*"
  "app/mailers/*"
  # Configurations
  "config/initializers/stripe.rb"
  "config/initializers/paypal.rb"
  "config/initializers/taxjar.rb"
  "config/currencies.json"
)

# Lists of required files from Project 2 (Next.js)
PROJECT2_FILES=(
  # App Store
  "app/[locale]/(root)/seller/apps/page.tsx"
  "app/api/integrations/*"
  "lib/api/integrations/*"
  "lib/db/models/integration.model.ts"
  "components/shared/*"
  # Setup Wizard
  "app/[locale]/(root)/seller/registration/page.tsx"
  "app/[locale]/(root)/seller/dashboard/welcome-modal.tsx"
  "lib/db/models/store.model.ts"
  "lib/db/models/seller.model.ts"
  # Integrations
  "lib/api/integrations/marketplaces/aliexpress/service.ts"
  "lib/api/integrations/amazon/service.ts"
  "lib/api/integrations/warehouses/shipbob/service.ts"
  "lib/api/integrations/warehouses/4px/service.ts"
  "app/api/payments/connect/[gateway]/route.ts"
  "app/api/webhooks/stripe/route.tsx"
  # UI and Design
  "components/ui/*"
  "components/shared/*"
  "app/globals.css"
  "app/[locale]/layout.tsx"
  "components/sections/*"
  # Icons and Assets
  "public/*"
  # i18n
  "i18n/*"
  # Documentation
  "docs/*"
  "lib/api/docs-generator.ts"
  # Services and Utilities
  "lib/services/*"
  "lib/db/models/*"
  "lib/utils/*"
  # Ambiguous Files (Need Clarification)
  "lib/db/منكش2"
  "lib/db/منكش3"
  "app/seller/warehouse/منكش4"
  "lib/services/warehouse/4منكش"
  # Configurations
  "lib/config/*"
  "next.config.js"
  "tailwind.config.ts"
)

# Initialize counters
COPIED_FILES=0
MISSING_FILES=0
MISSING_FILES_LIST=()

echo "Starting to collect required files for zipping..."

# Create output and temporary directories
mkdir -p "$TEMP_DIR1" "$TEMP_DIR2"
rm -f "$ZIP_FILE"

# Function to copy files and track missing ones
copy_files() {
  local source_path=$1
  local dest_path=$2
  local file_list=("${@:3}")
  
  for file in "${file_list[@]}"; do
    # Handle wildcards
    if [[ "$file" == *"*"* ]]; then
      if ls "$source_path/$file" >/dev/null 2>&1; then
        mkdir -p "$(dirname "$dest_path/$file")"
        cp -r "$source_path/$file" "$(dirname "$dest_path/$file")"
        echo "Copied: $file"
        ((COPIED_FILES++))
      else
        echo "Missing: $file"
        MISSING_FILES_LIST+=("$file")
        ((MISSING_FILES++))
      fi
    else
      if [ -f "$source_path/$file" ]; then
        mkdir -p "$(dirname "$dest_path/$file")"
        cp "$source_path/$file" "$dest_path/$file"
        echo "Copied: $file"
        ((COPIED_FILES++))
      else
        echo "Missing: $file"
        MISSING_FILES_LIST+=("$file")
        ((MISSING_FILES++))
      fi
    fi
  done
}

# Copy files from Project 1
echo "Copying files from Project 1 ($PROJECT1_PATH)..."
copy_files "$PROJECT1_PATH" "$TEMP_DIR1" "${PROJECT1_FILES[@]}"

# Copy files from Project 2
echo "Copying files from Project 2 ($PROJECT2_PATH)..."
copy_files "$PROJECT2_PATH" "$TEMP_DIR2" "${PROJECT2_FILES[@]}"

# Create ZIP archive
echo "Creating ZIP archive at $ZIP_FILE..."
cd "$OUTPUT_DIR"
zip -r "$ZIP_FILE" project1_files project2_files
cd -

# Clean up temporary directories
echo "Cleaning up temporary directories..."
rm -rf "$OUTPUT_DIR"

# Summary report
echo -e "\n=== Summary ==="
echo "Total files copied: $COPIED_FILES"
echo "Total files missing: $MISSING_FILES"
if [ $MISSING_FILES -gt 0 ]; then
  echo "Missing files:"
  for missing in "${MISSING_FILES_LIST[@]}"; do
    echo "- $missing"
  done
fi
echo "ZIP file created at: $ZIP_FILE"
echo "You can now upload this ZIP file to share the required files."
