package org.codefreak.codefreak.repository

import java.util.Optional
import java.util.UUID
import org.codefreak.codefreak.entity.GradingDefinition
import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository

@Repository
interface GradingDefinitionRepository : CrudRepository<GradingDefinition, UUID> {
  fun findByEvaluationStepDefinitionId(id: UUID): Optional<GradingDefinition>
}
