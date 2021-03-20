# Code FREAK Changelog

## [Unreleased]
### Added
* We have a changelog :tada:
* Times are now always relative to server time (#555)
* Add a share button to assignment view (#560)
* Add a button to reset the answer files to the initial boilerplate (#558)
* Submission table scrolls horizontally for many tasks (#561)
* Submission table contains the submission date (#561)
* The assignment list is sortable now (#595)
* The assignment list is filterable now (#616)
* The answer file view reloads if new files are uploaded (#584)
* IDE can be disabled and custom images can be used (#606)
* Tasks show the dates they were created and last updated (#617)
* The task pool list and the 'add tasks to assignment' list are now sortable and filterable (#616)
* The task pool can be exported and imported (#640)
* Evaluation steps will now be canceled after a configurable timeout (#647)
* Navigation can be hidden when giving assignment links to students (#667)
* Add API for individual file operations (#666)
* Admins can see the author of each assignment (#691)
* Individual evaluation steps are now run in parallel to make evaluation faster (#710)
* Make the IDE liveliness check work with URLs from other origin
* Evaluation step status is shown in real time (#714)
* If an evaluation step is marked inactive, export this too (#748)
* The options of evaluation steps are exported regardless of whether they are the default options or not (#750)
* When adding tasks to an assignment show whether the task pool is empty (#779)
* Evaluation time is shown in real time and elapsed time after completion
* Assignments can now be imported from the assignment list (#787)
* When creating an assignment users can now directly set the title and tasks (#787)
* Reschedule non-finished evaluation steps on backend startup (#804)
* Create project directory in IDE container before extracting files
* Add task template for C++
* Expose environment variables with information about the answer and user for commandline and junit runner
* Add a button to the task page to get back to the assignment (#844)
* Assignments show the dates they were created and last updated (#865)

### Changed
* Time limit can be specified on assignments and not on individual tasks (#635)
* The database of the development server is now seeded with the task templates and not from examples in the main repository (#771)
* Usability: Removed second level menu (Detail, Edit Details, Edit Configuration) from task configuration page, renamed task configuration page (#534)

### Removed
