//! A repository in memory: the reference the SQLite repository is compared
//! with, and a test double.

use super::document::ProfileDocument;
use super::ports::{ProfileRepository, RepositoryError};

/// Profiles kept in a list, in stored order.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct InMemoryProfileRepository {
    documents: Vec<ProfileDocument>,
}

impl InMemoryProfileRepository {
    /// A repository holding `documents` in this order.
    ///
    /// # Errors
    /// A document without a text id, or two documents with the same id.
    pub fn with_documents(documents: Vec<ProfileDocument>) -> Result<Self, RepositoryError> {
        let mut repository = Self::default();
        for document in documents {
            let id = text_id(&document)?;
            if repository
                .documents
                .iter()
                .any(|stored| stored.id() == Some(id))
            {
                return Err(RepositoryError::InvalidDocument(format!(
                    "duplicate id {id}"
                )));
            }
            repository.documents.push(document);
        }
        Ok(repository)
    }
}

fn text_id(document: &ProfileDocument) -> Result<&str, RepositoryError> {
    document
        .id()
        .ok_or_else(|| RepositoryError::InvalidDocument("profile without a text id".into()))
}

impl ProfileRepository for InMemoryProfileRepository {
    fn list(&self) -> Result<Vec<ProfileDocument>, RepositoryError> {
        Ok(self.documents.clone())
    }

    fn save(&mut self, document: ProfileDocument) -> Result<(), RepositoryError> {
        let id = text_id(&document)?;
        match self
            .documents
            .iter()
            .position(|stored| stored.id() == Some(id))
        {
            Some(position) => self.documents[position] = document,
            None => self.documents.push(document),
        }
        Ok(())
    }

    fn delete(&mut self, id: &str) -> Result<(), RepositoryError> {
        self.documents.retain(|stored| stored.id() != Some(id));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn doc(value: Value) -> ProfileDocument {
        ProfileDocument::from_value(value).unwrap_or_else(|| unreachable!())
    }

    fn ids(repository: &InMemoryProfileRepository) -> Vec<String> {
        repository
            .list()
            .unwrap_or_default()
            .iter()
            .filter_map(|d| d.id().map(str::to_string))
            .collect()
    }

    #[test]
    fn save_replaces_in_place_or_appends_and_delete_removes() -> Result<(), RepositoryError> {
        let mut repository = InMemoryProfileRepository::with_documents(vec![
            doc(json!({"id": "a"})),
            doc(json!({"id": "b"})),
        ])?;
        repository.save(doc(json!({"id": "a", "name": "new"})))?;
        repository.save(doc(json!({"id": "c"})))?;
        assert_eq!(ids(&repository), ["a", "b", "c"]);
        assert_eq!(repository.list()?[0].get("name"), Some(&json!("new")));
        repository.delete("b")?;
        repository.delete("missing")?;
        assert_eq!(ids(&repository), ["a", "c"]);
        Ok(())
    }

    #[test]
    fn documents_need_unique_text_ids() {
        assert!(matches!(
            InMemoryProfileRepository::with_documents(vec![
                doc(json!({"id": "a"})),
                doc(json!({"id": "a"}))
            ]),
            Err(RepositoryError::InvalidDocument(_))
        ));
        assert!(matches!(
            InMemoryProfileRepository::default().save(doc(json!({"id": 1}))),
            Err(RepositoryError::InvalidDocument(_))
        ));
    }
}
