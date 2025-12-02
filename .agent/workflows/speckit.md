---
description: Spec-Kit Workflow for feature specification, planning, and implementation
---

# Spec-Kit Workflow

The Spec-Kit workflow provides a structured approach to feature development, from specification to implementation.

## Commands

The following commands are available in `.gemini/commands`:

### 1. Specify Feature
Create or update a feature specification from a natural language description.
- **Command**: `/speckit.specify`
- **Usage**: `/speckit.specify [feature description]`
- **Input**: Natural language description of the feature.
- **Output**: A new branch and a `spec.md` file.

### 2. Clarify Requirements
Clarify ambiguities in the specification.
- **Command**: `/speckit.clarify`
- **Usage**: `/speckit.clarify`
- **Prerequisite**: A `spec.md` file must exist.

### 3. Plan Implementation
Create a technical implementation plan.
- **Command**: `/speckit.plan`
- **Usage**: `/speckit.plan`
- **Prerequisite**: A completed `spec.md`.

### 4. Create Tasks
Break down the plan into actionable tasks.
- **Command**: `/speckit.tasks`
- **Usage**: `/speckit.tasks`
- **Prerequisite**: A completed `plan.md`.

### 5. Analyze Consistency
Analyze consistency across spec, plan, and tasks.
- **Command**: `/speckit.analyze`
- **Usage**: `/speckit.analyze`
- **Prerequisite**: `spec.md`, `plan.md`, and `tasks.md`.

### 6. Implement Feature
Start the implementation process.
- **Command**: `/speckit.implement`
- **Usage**: `/speckit.implement`

### Other Utilities
- `/speckit.checklist`: Generate checklists.
- `/speckit.constitution`: Manage project constitution.
- `/speckit.taskstoissues`: Convert tasks to issues.

## Workflow Steps

1. **Start a new feature**: Use `/speckit.specify` with a description.
2. **Refine the spec**: Use `/speckit.clarify` if needed.
3. **Plan the technical approach**: Run `/speckit.plan`.
4. **Generate tasks**: Run `/speckit.tasks`.
5. **Validate artifacts**: Run `/speckit.analyze` to ensure consistency.
6. **Implement**: Use `/speckit.implement` to start coding.
