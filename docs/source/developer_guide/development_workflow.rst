.. _development workflow:

Development workflow
====================

Prerequisites
-------------

* Docker: https://docs.docker.com/get-docker/
* pre-commit: https://pre-commit.com/#installation

Building
--------
Since Orchest is a fully containerized application you will first have to build the containers.

.. code-block:: bash

   # It is also possible to specify certain flags, running it without
   # any will build all containers in parallel. Due to Docker's
   # layering system this should be rather quick.
   scripts/build_container.sh

Incremental development
-----------------------
Orchest supports incremental development by starting Orchest in ``dev`` mode. This allows you to
make code changes that are instantly reflected, without having to build the containers again.

.. code-block:: bash

   # Before Orchest can be run in "dev" mode the front-end code has to
   # be compiled.
   scripts/dev_compile_frontend.sh

   ./orchest start dev

.. note::
   ``dev`` mode is supported for the following services: ``orchest-webserver``, ``auth-server``,
   ``file-manager`` and ``orchest-api``. For changes to other services you will have to run the
   build script again to rebuild the container (``scripts/build_container.sh -i <service-name>``)
   and restart Orchest (``./orchest restart --mode=dev``) to make sure the newly build container is
   used.

In ``dev`` mode the repository code from the filesystem is mounted (and thus adhering to git
branches) to the appropriate paths in the Docker containers. This allows for active code changes
being reflected inside the application. In ``dev`` mode the Flask applications are run in
development mode.


.. _before committing:

Before committing
-----------------

Install all development dependencies using:

.. code-block:: bash

   pre-commit install

Run formatters, linters and tests with:

.. code-block:: bash

    pre-commit run
    scripts/run_tests.sh
