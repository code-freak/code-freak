package org.codefreak.codefreak.entity

import javax.persistence.Column
import javax.persistence.Entity
import javax.persistence.ManyToOne
import org.hibernate.annotations.ColumnDefault
import org.hibernate.annotations.Type

@Entity
class EvaluationStepDefinition(
  @ManyToOne(optional = false)
  var task: Task,
  var runnerName: String,
  var position: Int,
  var title: String,

  @Type(type = "json")
  @Column(length = 1024)
  @ColumnDefault("'{}'")
  var options: Map<String, Any> = mapOf()
) : BaseEntity() {
  var active: Boolean = true
}
