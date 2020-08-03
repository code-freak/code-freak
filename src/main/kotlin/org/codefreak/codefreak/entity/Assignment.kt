package org.codefreak.codefreak.entity

import java.time.Instant
import java.util.SortedSet
import javax.persistence.CascadeType
import javax.persistence.Column
import javax.persistence.Entity
import javax.persistence.EntityListeners
import javax.persistence.ManyToOne
import javax.persistence.OneToMany
import javax.persistence.OrderBy
import org.codefreak.codefreak.service.AssignmentStatusChangePublisher
import org.hibernate.annotations.ColumnDefault
import org.hibernate.annotations.CreationTimestamp

@Entity
@EntityListeners(AssignmentStatusChangePublisher::class)
class Assignment(
  /**
   * A title for this assignment
   * e.g. "Java Threads and Runnable"
   */
  @Column(nullable = false)
  var title: String,

  /**
   * The teacher who created this assignment
   */
  @ManyToOne
  var owner: User,

  var openFrom: Instant? = null,
  var deadline: Instant? = null,
  @ColumnDefault("false")
  var active: Boolean = false
) : BaseEntity() {
  /**
   * A list of tasks in this assignment ordered by their position
   */
  @OneToMany(mappedBy = "assignment", cascade = [CascadeType.REMOVE])
  @OrderBy("position ASC")
  var tasks: SortedSet<Task> = sortedSetOf<Task>()
    get() = field.sortedBy { it.position }.toSortedSet()

  val status get() = when {
    !active -> AssignmentStatus.INACTIVE
    openFrom == null || Instant.now().isBefore(openFrom) -> AssignmentStatus.ACTIVE
    deadline == null || Instant.now().isBefore(deadline) -> AssignmentStatus.OPEN
    else -> AssignmentStatus.CLOSED
  }

  @CreationTimestamp
  var createdAt: Instant = Instant.now()

  @OneToMany(mappedBy = "assignment", cascade = [CascadeType.REMOVE])
  var submissions = mutableSetOf<Submission>()
}
