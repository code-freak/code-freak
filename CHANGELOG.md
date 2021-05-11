# Code FREAK Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]
### Added
* Add support for CodeClimate `location.positions` format

### Changed

### Removed


## [6.0.0](https://github.com/codefreak/codefreak/releases/tag/6.0.0) - 2020-03-26

### Added
* We have a changelog :tada:
* Times are now always relative to server time ([#555](https://github.com/codefreak/codefreak/pull/555))
* Add a share button to assignment view ([#560](https://github.com/codefreak/codefreak/pull/560))
* Add a button to reset the answer files to the initial boilerplate ([#558](https://github.com/codefreak/codefreak/pull/558))
* Submission table scrolls horizontally for many tasks ([#561](https://github.com/codefreak/codefreak/pull/561))
* Submission table contains the submission date ([#561](https://github.com/codefreak/codefreak/pull/561))
* The assignment list is sortable now ([#595](https://github.com/codefreak/codefreak/pull/595))
* The assignment list is filterable now ([#616](https://github.com/codefreak/codefreak/pull/616))
* The answer file view reloads if new files are uploaded ([#584](https://github.com/codefreak/codefreak/pull/584))
* IDE can be disabled and custom images can be used ([#606](https://github.com/codefreak/codefreak/pull/606))
* Tasks show the dates they were created and last updated ([#617](https://github.com/codefreak/codefreak/pull/617))
* The task pool list and the 'add tasks to assignment' list are now sortable and filterable ([#616](https://github.com/codefreak/codefreak/pull/616))
* The task pool can be exported and imported ([#640](https://github.com/codefreak/codefreak/pull/640))
* Evaluation steps will now be canceled after a configurable timeout ([#647](https://github.com/codefreak/codefreak/pull/647))
* Navigation can be hidden when giving assignment links to students ([#667](https://github.com/codefreak/codefreak/pull/667))
* Add API for individual file operations ([#666](https://github.com/codefreak/codefreak/pull/666))
* Admins can see the author of each assignment ([#691](https://github.com/codefreak/codefreak/pull/691))
* Individual evaluation steps are now run in parallel to make evaluation faster ([#710](https://github.com/codefreak/codefreak/pull/710))
* Make the IDE liveliness check work with URLs from other origin
* Evaluation step status is shown in real time ([#714](https://github.com/codefreak/codefreak/pull/714))
* If an evaluation step is marked inactive, export this too ([#748](https://github.com/codefreak/codefreak/pull/748))
* The options of evaluation steps are exported regardless of whether they are the default options or not ([#750](https://github.com/codefreak/codefreak/pull/750))
* When adding tasks to an assignment show whether the task pool is empty ([#779](https://github.com/codefreak/codefreak/pull/779))
* Evaluation time is shown in real time and elapsed time after completion
* Assignments can now be imported from the assignment list ([#787](https://github.com/codefreak/codefreak/pull/787))
* When creating an assignment users can now directly set the title and tasks ([#787](https://github.com/codefreak/codefreak/pull/787))
* Reschedule non-finished evaluation steps on backend startup ([#804](https://github.com/codefreak/codefreak/pull/804))
* Create project directory in IDE container before extracting files
* Add task template for C++
* Expose environment variables with information about the answer and user for commandline and junit runner
* Add a button to the task page to get back to the assignment ([#844](https://github.com/codefreak/codefreak/pull/844))
* Assignments show the dates they were created and last updated ([#865](https://github.com/codefreak/codefreak/pull/865))
* Add IDE presets that will allow beta-testing of Breeze ([#871](https://github.com/codefreak/codefreak/pull/871))

### Changed
* Time limit can be specified on assignments and not on individual tasks ([#635](https://github.com/codefreak/codefreak/pull/635))
* The database of the development server is now seeded with the task templates and not from examples in the main repository ([#771](https://github.com/codefreak/codefreak/pull/771))
* The timestamp of the last update is displayed in task pool and assignment list ([#552](https://github.com/codefreak/codefreak/pull/552))
* The timestamp of the last update is shown in assignment details page ([#556](https://github.com/codefreak/codefreak/pull/556))
* Don't show a "Default configuration" label on evaluation step configurations if there is no configuration ([#917](https://github.com/codefreak/codefreak/pull/917))
