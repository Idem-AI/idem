#!/bin/bash

# Script to update all route references from old paths to new console/project/ paths

echo "Updating route references..."

# Find all TypeScript and HTML files in the dashboard module
find ./src/app/modules/dashboard -type f \( -name "*.ts" -o -name "*.html" \) -exec sed -i '' \
  -e "s|'/console/branding'|'/console/project/branding'|g" \
  -e "s|'/console/branding/generate'|'/console/project/branding/generate'|g" \
  -e "s|'/console/business-plan'|'/console/project/business-plan'|g" \
  -e "s|'/console/business-plan/generate'|'/console/project/business-plan/generate'|g" \
  -e "s|'/console/diagrams'|'/console/project/diagrams'|g" \
  -e "s|'/console/diagrams/generate'|'/console/project/diagrams/generate'|g" \
  -e "s|'/console/tests'|'/console/project/tests'|g" \
  -e "s|'/console/development'|'/console/project/development'|g" \
  -e "s|'/console/development/create'|'/console/project/development/create'|g" \
  -e "s|'/console/deployments'|'/console/project/deployments'|g" \
  -e "s|'/console/deployments/create'|'/console/project/deployments/create'|g" \
  -e "s|'/console/project-teams'|'/console/project/teams'|g" \
  -e "s|'/console/profile'|'/console/project/profile'|g" \
  -e "s|'/console/teams/add-to-project'|'/console/project/teams/add'|g" \
  -e "s|\['/console/branding'\]|['/console/project/branding']|g" \
  -e "s|\['/console/business-plan'\]|['/console/project/business-plan']|g" \
  -e "s|\['/console/diagrams'\]|['/console/project/diagrams']|g" \
  -e "s|\['/console/development'\]|['/console/project/development']|g" \
  -e "s|\['/console/deployments'\]|['/console/project/deployments']|g" \
  -e "s|\['/console/deployments/create'\]|['/console/project/deployments/create']|g" \
  {} \;

# Also update in layouts and shared components
find ./src/app/layouts -type f \( -name "*.ts" -o -name "*.html" \) -exec sed -i '' \
  -e "s|'/console/profile'|'/console/project/profile'|g" \
  {} \;

find ./src/app/shared -type f \( -name "*.ts" -o -name "*.html" \) -exec sed -i '' \
  -e "s|'/console/deployments'|'/console/project/deployments'|g" \
  {} \;

echo "Route references updated successfully!"
