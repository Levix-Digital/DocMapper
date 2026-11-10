//! The typed profile model of `mapping.ts`, read from a stored profile for
//! the modules that use profiles (LSIE in M4, batch in M6, stamping in M7).
//! Profiles are stored as documents; this is a read model.

use super::document::ProfileDocument;
use serde::Deserialize;
use std::fmt;

/// A box on a page, in percentages of the page (0 to 100) and a 1-based page.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub page: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldDataType {
    Text,
    Alphanumeric,
    Date,
    Number,
    Multiline,
}

/// A field read from the source document.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDefinition {
    pub id: String,
    pub name: String,
    pub color: String,
    pub label_box: Option<BoundingBox>,
    pub anchor_text: Option<String>,
    pub value_box: Option<BoundingBox>,
    pub validation_pattern: String,
    pub data_type: FieldDataType,
    pub is_required: bool,
    pub sample_extracted_value: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum RenderFormat {
    #[serde(rename = "TEXT")]
    Text,
    #[serde(rename = "CODE128")]
    Code128,
    #[serde(rename = "QR_CODE")]
    QrCode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HorizontalAlignment {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerticalAlignment {
    Top,
    Middle,
    Bottom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DestinationMappingSourceType {
    Field,
    Custom,
}

/// Where and how a value is drawn on the destination template.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DestinationFieldMapping {
    pub id: String,
    pub source_type: Option<DestinationMappingSourceType>,
    /// `null` and absent both mean no field.
    pub field_id: Option<String>,
    pub custom_text: Option<String>,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub target_box: BoundingBox,
    pub render_format: RenderFormat,
    pub font_size: Option<f64>,
    pub horizontal_align: Option<HorizontalAlignment>,
    pub vertical_align: Option<VerticalAlignment>,
}

/// A mapping profile.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingProfile {
    pub id: String,
    pub name: String,
    pub version: f64,
    pub created_at: String,
    pub updated_at: String,
    pub fields: Vec<FieldDefinition>,
    /// The destination PDF template, Base64.
    pub destination_template_base64: Option<String>,
    pub destination_template_name: Option<String>,
    pub destination_mappings: Vec<DestinationFieldMapping>,
    pub output_file_name_pattern: Option<String>,
}

/// A stored profile does not fit the model.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelError {
    /// The error, with the JSON path and position of what does not fit.
    pub reason: String,
}

impl fmt::Display for ModelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "profile does not fit the mapping profile model: {}",
            self.reason
        )
    }
}

impl std::error::Error for ModelError {}

impl MappingProfile {
    /// Reads the typed profile from a stored one; unknown keys are ignored.
    ///
    /// # Errors
    /// [`ModelError`] when a key is missing or has the wrong type.
    pub fn from_document(document: &ProfileDocument) -> Result<Self, ModelError> {
        Self::deserialize(serde_json::Value::Object(document.as_map().clone())).map_err(|error| {
            ModelError {
                reason: error.to_string(),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn doc(value: serde_json::Value) -> ProfileDocument {
        ProfileDocument::from_value(value).unwrap_or_else(|| unreachable!())
    }

    #[test]
    fn reads_a_full_profile() -> Result<(), ModelError> {
        let profile = MappingProfile::from_document(&doc(json!({
            "id": "p", "name": "CMR", "version": 1, "createdAt": "c", "updatedAt": "u", "extra": true,
            "fields": [{
                "id": "f", "name": "Seal", "color": "#fff", "anchorText": "Seal",
                "labelBox": {"x": 6.65, "y": 30.7, "width": 12.5, "height": 0.8, "page": 1},
                "valueBox": {"x": 16, "y": 36.3, "width": 6.8, "height": 0.6, "page": 1},
                "validationPattern": "", "dataType": "alphanumeric", "isRequired": true
            }],
            "destinationTemplateBase64": "JVBERi0=",
            "destinationMappings": [
                {"id": "d1", "fieldId": "f", "targetBox": {"x": 1, "y": 2, "width": 3, "height": 4, "page": 3}, "renderFormat": "CODE128"},
                {"id": "d2", "sourceType": "custom", "fieldId": null, "customText": "OK", "fontSize": 10.5,
                 "horizontalAlign": "center", "verticalAlign": "bottom",
                 "targetBox": {"x": 1, "y": 2, "width": 3, "height": 4, "page": 1}, "renderFormat": "QR_CODE"}
            ],
            "outputFileNamePattern": "{seq}"
        })))?;
        assert_eq!(profile.fields[0].data_type, FieldDataType::Alphanumeric);
        assert_eq!(
            profile.fields[0].value_box.as_ref().map(|b| b.x),
            Some(16.0)
        );
        assert_eq!(
            profile.destination_mappings[0].render_format,
            RenderFormat::Code128
        );
        assert_eq!(profile.destination_mappings[1].field_id, None);
        assert_eq!(
            profile.destination_mappings[1].horizontal_align,
            Some(HorizontalAlignment::Center)
        );
        assert_eq!(
            profile.destination_mappings[1].source_type,
            Some(DestinationMappingSourceType::Custom)
        );
        assert_eq!(
            profile.destination_mappings[1].vertical_align,
            Some(VerticalAlignment::Bottom)
        );
        Ok(())
    }

    #[test]
    fn reports_what_does_not_fit() {
        let error = MappingProfile::from_document(&doc(json!({"id": "p", "name": 5}))).err();
        assert!(error.is_some_and(|e| e
            .to_string()
            .starts_with("profile does not fit the mapping profile model: invalid type")));
    }
}
