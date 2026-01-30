cmake_minimum_required(VERSION 3.16)
project(isce3proc VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Options for optional dependencies
option(WITH_ISCE3 "Build with ISCE3 library" OFF)
option(WITH_HDF5 "Build with HDF5 support" OFF)

# Build facade as shared library
add_library(isce3proc SHARED
    RangeCompFacade.cpp
)

target_include_directories(isce3proc PUBLIC 
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Conditional ISCE3 linkage
if(WITH_ISCE3)
    find_package(isce3 REQUIRED)
    target_compile_definitions(isce3proc PRIVATE HAVE_ISCE3)
    target_link_libraries(isce3proc PUBLIC isce3::isce3)
endif()

# Conditional HDF5 linkage
if(WITH_HDF5)
    find_package(HDF5 REQUIRED COMPONENTS CXX)
    target_compile_definitions(isce3proc PRIVATE HAVE_HDF5)
    target_include_directories(isce3proc PRIVATE ${HDF5_INCLUDE_DIRS})
    target_link_libraries(isce3proc PUBLIC ${HDF5_CXX_LIBRARIES})
endif()

# Install targets
install(TARGETS isce3proc
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)

install(FILES RangeCompFacade.h
    DESTINATION include
)
